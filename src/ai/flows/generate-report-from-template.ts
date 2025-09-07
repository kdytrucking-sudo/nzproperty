
'use server';
/**
 * Generates a Word document from a template, filling in text and image placeholders.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs/promises';
import path from 'path';
import { ImageOptionsSchema } from '@/lib/image-options-schema';

// ESM compatibility for require
const ImageModule = require('docxtemplater-image-module-free');

/* -----------------------------
 * Schemas
 * ----------------------------- */

const GenerateReportInputSchema = z.object({
  templateFileName: z.string().describe('The file name of the .docx template stored on the server.'),
  data: z.any().describe('The JSON data to populate the template with, including an `images` property.'),
});
export type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

const GenerateReportOutputSchema = z.object({
  generatedDocxDataUri: z.string().describe('The generated .docx file as a data URI.'),
  replacementsCount: z.number().describe('The number of placeholders that were replaced.'),
});
export type GenerateReportOutput = z.infer<typeof GenerateReportOutputSchema>;

/* -----------------------------
 * Data preparation for Docxtemplater
 * ----------------------------- */
const normalizeNewlines = (s: unknown): string =>
  s !== undefined && s !== null
    ? String(s).replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    : '';

const prepareTemplateData = async (data: any) => {
  const templateData: Record<string, any> = {};
  let replacementCount = 0;
  
  const jsonStructurePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
  const jsonString = await fs.readFile(jsonStructurePath, 'utf-8');
  const jsonStructure = JSON.parse(jsonString);


  const countAndSetReplacement = (key: string, value: any): void => {
    const normalizedValue = normalizeNewlines(value);
    const finalKey = key.startsWith('Replace_') ? key : `Replace_${key}`;
    templateData[finalKey] = normalizedValue;

    if (Array.isArray(value)) {
      const hasContent = value.some((item: any) =>
        Object.values(item ?? {}).some((v: any) =>
          typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null && v !== ''
        )
      );
      if (hasContent) replacementCount++;
    } else if (typeof value === 'string') {
      if (value.trim() !== '' && value.trim() !== 'N/A') replacementCount++;
    } else if (value !== undefined && value !== null && value !== '') {
      replacementCount++;
    }
  };
  
  Object.keys(jsonStructure).forEach((sectionKey) => {
    const sectionSchema = jsonStructure[sectionKey] || {};
    const dataSection = data?.[sectionKey];

    if (dataSection) {
      Object.keys(dataSection).forEach((fieldKey) => {
        const fieldConfig = sectionSchema[fieldKey];
        if (fieldConfig && typeof fieldConfig === 'object' && fieldConfig.placeholder) {
          const templateKey = fieldConfig.placeholder.replace(/\[|\]/g, '');
          const value = dataSection[fieldKey];
          countAndSetReplacement(templateKey, value);
        }
      });
    }
  });

  if (data?.commentary) {
    const placeholderMapping: Record<string, string> = {
      PurposeofValuation: 'Replace_PurposeofValuation',
      PrincipalUse: 'Replace_PrincipalUse',
      PreviousSale: 'Replace_PreviousSale',
      ContractSale: 'Replace_ContractSale',
      SuppliedDocumentation: 'Replace_SuppliedDoc',
      RecentOrProvided: 'Replace_RecentOrProvided',
      LIM: 'Replace_LIM',
      PC78: 'Replace_PC78',
      OperativeZone: 'Replace_Zone',
      ZoningOptionOperative: 'Replace_ZoningOptionOperative',
      ZoningOptionPC78: 'Replace_ZoningOptionPC78',
      ConditionAndRepair: 'Replace_ConditionAndRepair',
    };
    Object.keys(data.commentary).forEach((key: string) => {
      const templateKey = placeholderMapping[key];
      if (templateKey) {
        countAndSetReplacement(templateKey, data.commentary[key]);
      }
    });
  }

  if (data?.constructionBrief?.finalBrief) {
    countAndSetReplacement('Replace_ConstructionBrief', data.constructionBrief.finalBrief);
  }

  if (data?.marketValuation) {
    if (data.marketValuation.marketValue) {
        countAndSetReplacement('Replace_MarketValue', data.marketValuation.marketValue);
    }
    if (data.marketValuation.marketValuation) {
        countAndSetReplacement('Replace_MarketValuation', data.marketValuation.marketValuation);
    }
    if (data.marketValuation.improvementsValueByValuer) {
        countAndSetReplacement('Replace_ImprovementValueByValuer', data.marketValuation.improvementsValueByValuer);
    }
    if (data.marketValuation.landValueByValuer) {
        countAndSetReplacement('Replace_LandValueByValuer', data.marketValuation.landValueByValuer);
    }
    if (data.marketValuation.chattelsValueByValuer) {
        countAndSetReplacement('Replace_ChattelsByValuer', data.marketValuation.chattelsValueByValuer);
    }
    if (data.marketValuation.marketValueByValuer) {
        countAndSetReplacement('Replace_MarketValueByValuer', data.marketValuation.marketValueByValuer);
    }
  }

  if (Array.isArray(data?.comparableSales)) {
    templateData['comparableSales'] = data.comparableSales.map((sale: Record<string, any>) => {
      const n: Record<string, any> = {};
      Object.keys(sale).forEach((k: string) => {
        const v = sale[k] ?? '';
        n[k] = normalizeNewlines(v);
      });
      return n;
    });
    countAndSetReplacement('comparableSales', data.comparableSales);
  } else {
    templateData['comparableSales'] = [];
  }

  if (data?.statutoryValuation) {
    countAndSetReplacement('Replace_LandValueFromWeb', data.statutoryValuation.landValueByWeb);
    countAndSetReplacement('Replace_ValueofImprovementsFromWeb', data.statutoryValuation.improvementsValueByWeb);
    countAndSetReplacement('Replace_RatingValuationFromWeb', data.statutoryValuation.ratingValueByWeb);
  }
  
  if (data?.images && typeof data.images === 'object') {
    Object.keys(data.images).forEach(placeholder => {
        const imageDataUri = data.images[placeholder];
        if (imageDataUri) {
            // The key for docxtemplater should be the placeholder without the delimiters
            const key = placeholder.trim().replace(/^\{\%/, '').replace(/\}$/, '');
            templateData[key] = imageDataUri;
            replacementCount++;
        }
    });
  }

  Object.keys(data).forEach(key => {
    if (key.startsWith('Replace_')) {
      const alreadyHandled = [
        'Replace_PurposeofValuation', 'Replace_PrincipalUse', 'Replace_PreviousSale', 'Replace_ContractSale',
        'Replace_SuppliedDoc', 'Replace_RecentOrProvided', 'Replace_LIM', 'Replace_PC78', 'Replace_Zone',
        'Replace_ZoningOptionOperative', 'Replace_ZoningOptionPC78', 'Replace_ConditionAndRepair',
        'Replace_ConstructionBrief', 'Replace_MarketValue', 'Replace_MarketValuation', 'Replace_ImprovementValueByValuer',
        'Replace_LandValueByValuer', 'Replace_ChattelsByValuer', 'Replace_MarketValueByValuer',
        'Replace_LandValueFromWeb', 'Replace_ValueofImprovementsFromWeb', 'Replace_RatingValuationFromWeb'
      ].includes(key);

      const isFromJsonStructure = Object.values(jsonStructure).some((section: any) => 
        Object.values(section).some((field: any) => field.placeholder?.replace(/\[|\]/g, '') === key)
      );

      if (!alreadyHandled && !isFromJsonStructure) {
         countAndSetReplacement(key, data[key]);
      }
    }
  });


  return { templateData, replacementCount };
};

/* -----------------------------
 * Flow
 * ----------------------------- */

export async function generateReportFromTemplate(
  input: GenerateReportInput
): Promise<GenerateReportOutput> {
  return generateReportFromTemplateFlow(input);
}

const generateReportFromTemplateFlow = ai.defineFlow(
  {
    name: 'generateReportFromTemplateFlow',
    inputSchema: GenerateReportInputSchema,
    outputSchema: GenerateReportOutputSchema,
  },
  async ({ templateFileName, data }) => {
    const templatesDir = path.join(process.cwd(), 'src', 'lib', 'templates');
    const templatePath = path.join(templatesDir, templateFileName);

    try {
      const buffer = await fs.readFile(templatePath);
      const zip = new PizZip(buffer);

      const imageOptionsPath = path.join(process.cwd(), 'src', 'lib', 'image-options.json');
      const imageOptionsJson = await fs.readFile(imageOptionsPath, 'utf-8');
      const imageConfigs = ImageOptionsSchema.parse(JSON.parse(imageOptionsJson));
      
      const imageSizeMap = new Map<string, { width: number; height: number }>();
      imageConfigs.forEach(config => {
        // The key for the map should also be the placeholder without delimiters.
        const key = config.placeholder.trim().replace(/^\{\%/, '').replace(/\}$/, '');
        imageSizeMap.set(key, { width: config.width, height: config.height });
      });

      const imageModule = new ImageModule({
        fileType: 'docx',
        centered: false,
        getImage(tagValue: unknown) {
          if (Buffer.isBuffer(tagValue)) return tagValue;
          // tagValue is the a data URI string in our case
          if (typeof tagValue === 'string' && tagValue.startsWith('data:')) {
            const b64 = tagValue.split(',')[1] ?? '';
            return Buffer.from(b64, 'base64');
          }
          throw new Error('getImage: expected Buffer or data URI string');
        },
        getSize(_img: Buffer, _tagValue: unknown, tagName: string) {
          // tagName is the placeholder key, e.g. "Image_NatureofProperty1"
          const size = imageSizeMap.get(tagName);
          if (size) {
            return [size.width, size.height];
          }
          // Fallback size if no configuration is found
          return [300, 200];
        },
      });
      
      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        delimiters: { start: '[', end: ']' },
        // Use paragraphLoop for looping over sales data
        paragraphLoop: true,
      });

      const { templateData, replacementCount } = await prepareTemplateData(data);
      doc.setData(templateData);

      try {
        doc.render();
      } catch (error: any) {
        console.error('Docxtemplater rendering error:', JSON.stringify(error, null, 2));
        let errorMessage = 'Failed to render the document due to a template error.';
        if (error.properties && error.properties.errors) {
          const firstError = error.properties.errors[0];
          errorMessage += ` Details: ${firstError.properties.explanation} (ID: ${firstError.id})`;
        }
        throw new Error(errorMessage);
      }

      const outputBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      const outputBase64 = outputBuffer.toString('base64');
      const outputDataUri =
        `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${outputBase64}`;

      return {
        generatedDocxDataUri: outputDataUri,
        replacementsCount: replacementCount,
      };
    } catch (error: any) {
      console.error(`Error processing template file ${templateFileName}:`, error);
      if (error.code === 'ENOENT') {
        throw new Error(`Template file "${templateFileName}" not found on the server.`);
      }
      throw new Error(error.message || 'Failed to read or process the template file.');
    }
  }
);
