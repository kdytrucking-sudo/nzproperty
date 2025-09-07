
'use server';
/**
 * Generates a Word report by first replacing image placeholders and then
 * text placeholders in a two-stage process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs/promises';
import path from 'path';
import { contentFields } from '@/lib/content-config';
import type { MultiOptionCard } from '@/lib/multi-options-schema';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ImageModule = require('docxtemplater-image-module-free');


/* -----------------------------
 * Schemas
 * ----------------------------- */

const ImageInfoSchema = z.object({
  placeholder: z.string().describe('Text tag in template, e.g. {%report_logo}'),
  imageDataUri: z.string().describe('Image as data URI, e.g. data:image/png;base64,...'),
  width: z.number().describe('Width in pixels.'),
  height: z.number().describe('Height in pixels.'),
});

const GenerateReportInputSchema = z.object({
  templateFileName: z.string().describe('The file name of the .docx template stored on the server.'),
  data: z.any().describe('The JSON data to populate the text placeholders with.'),
  images: z.array(ImageInfoSchema).optional().describe('An array of image information to replace.'),
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

const prepareTextData = async (data: any) => {
  const templateData: Record<string, any> = {};
  let replacementCount = 0;

  const normalizeNewlines = (s: unknown): string =>
    s !== undefined && s !== null
      ? String(s).replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      : '';

  const countAndSetReplacement = (key: string, value: any): void => {
    const normalizedValue = normalizeNewlines(value);
    const finalKey = key.startsWith('Replace_') ? key : `Replace_${key}`;
    templateData[finalKey] = normalizedValue;
    if (value && String(value).trim() !== '' && String(value).trim() !== 'N/A') {
      replacementCount++;
    }
  };
  
  // 1. JSON Structure Data
  const jsonStructurePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
  const jsonString = await fs.readFile(jsonStructurePath, 'utf-8');
  const jsonStructure = JSON.parse(jsonString);

  Object.keys(jsonStructure).forEach((sectionKey) => {
    const sectionSchema = jsonStructure[sectionKey] || {};
    const dataSection = data?.[sectionKey];
    if (dataSection) {
      Object.keys(dataSection).forEach((fieldKey) => {
        const fieldConfig = sectionSchema[fieldKey];
        if (fieldConfig && typeof fieldConfig === 'object' && fieldConfig.placeholder) {
          const templateKey = fieldConfig.placeholder.replace(/\[|\]/g, '');
          countAndSetReplacement(templateKey, dataSection[fieldKey]);
        }
      });
    }
  });

  // 2. Global Content
  const globalContentPath = path.join(process.cwd(), 'src', 'lib', 'global-content.json');
  const globalContentString = await fs.readFile(globalContentPath, 'utf-8');
  const globalContent = JSON.parse(globalContentString);
  contentFields.forEach((field: any) => {
    const templateKey = String(field.templateKey).replace(/\[|\]/g, '');
    countAndSetReplacement(templateKey, globalContent[field.name as keyof typeof globalContent]);
  });
  
  // 3. Commentary
  if (data?.commentary) {
    const placeholderMapping: Record<string, string> = {
      PurposeofValuation: 'Replace_PurposeofValuation', PrincipalUse: 'Replace_PrincipalUse',
      PreviousSale: 'Replace_PreviousSale', ContractSale: 'Replace_ContractSale',
      SuppliedDocumentation: 'Replace_SuppliedDoc', RecentOrProvided: 'Replace_RecentOrProvided',
      LIM: 'Replace_LIM', PC78: 'Replace_PC78', OperativeZone: 'Replace_Zone',
      ZoningOptionOperative: 'Replace_ZoningOptionOperative', ZoningOptionPC78: 'Replace_ZoningOptionPC78',
      ConditionAndRepair: 'Replace_ConditionAndRepair',
    };
    Object.keys(data.commentary).forEach((key: string) => {
      if (placeholderMapping[key]) {
        countAndSetReplacement(placeholderMapping[key], data.commentary[key]);
      }
    });
  }

  // 4. Other Sections
  if (data?.constructionBrief?.finalBrief) {
    countAndSetReplacement('Replace_ConstructionBrief', data.constructionBrief.finalBrief);
  }
  if (data?.marketValuation) {
    if (data.marketValuation.marketValue) countAndSetReplacement('Replace_MarketValue', data.marketValuation.marketValue);
    if (data.marketValuation.marketValuation) countAndSetReplacement('Replace_MarketValuation', data.marketValuation.marketValuation);
    if (data.marketValuation.improvementsValueByValuer) countAndSetReplacement('Replace_ImprovementValueByValuer', data.marketValuation.improvementsValueByValuer);
    if (data.marketValuation.landValueByValuer) countAndSetReplacement('Replace_LandValueByValuer', data.marketValuation.landValueByValuer);
    if (data.marketValuation.chattelsValueByValuer) countAndSetReplacement('Replace_ChattelsByValuer', data.marketValuation.chattelsValueByValuer);
    if (data.marketValuation.marketValueByValuer) countAndSetReplacement('Replace_MarketValueByValuer', data.marketValuation.marketValueByValuer);
  }
  if (data?.statutoryValuation) {
    countAndSetReplacement('Replace_LandValueFromWeb', data.statutoryValuation.landValueByWeb);
    countAndSetReplacement('Replace_ValueofImprovementsFromWeb', data.statutoryValuation.improvementsValueByWeb);
    countAndSetReplacement('Replace_RatingValuationFromWeb', data.statutoryValuation.ratingValueByWeb);
  }

  // 5. Multi-options
  const multiOptionsPath = path.join(process.cwd(), 'src', 'lib', 'multi-options.json');
  const multiOptionsString = await fs.readFile(multiOptionsPath, 'utf-8');
  const multiOptions: MultiOptionCard[] = JSON.parse(multiOptionsString);
  
  multiOptions.forEach((card: MultiOptionCard) => {
    const placeholderKey = card.placeholder.replace(/\[|\]/g, '');
    if (data[placeholderKey]) {
      countAndSetReplacement(placeholderKey, data[placeholderKey]);
    }
  });
  
  // 6. Comparable Sales (Loop)
  if (Array.isArray(data?.comparableSales)) {
    templateData['comparableSales'] = data.comparableSales.map((sale: Record<string, any>) => {
      const normalizedSale: Record<string, any> = {};
      Object.keys(sale).forEach((k: string) => {
        normalizedSale[k] = normalizeNewlines(sale[k] ?? '');
      });
      return normalizedSale;
    });
    countAndSetReplacement('comparableSales', data.comparableSales);
  } else {
    templateData['comparableSales'] = [];
  }

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
  async ({ templateFileName, data, images }) => {
    const templatesDir = path.join(process.cwd(), 'src', 'lib', 'templates');
    const templatePath = path.join(templatesDir, templateFileName);

    try {
      let buffer = await fs.readFile(templatePath);

      // GPT, THIS IS FOR YOU:
      // STAGE 1: Replace Images.
      // The `images` variable is an array of objects, each with:
      // - placeholder: string (e.g., "{%Image_NatureofProperty1}")
      // - imageDataUri: string (e.g., "data:image/png;base64,...")
      // - width: number
      // - height: number
      //
      // Use the 'docxtemplater-image-module-free' to replace these placeholders.
      // After this stage, the `buffer` variable should contain the content
      // of the docx file with images replaced, ready for Stage 2.
      // Make sure to handle the case where `images` is undefined or empty.

      if (images && images.length > 0) {
        // <<<< INSERT IMAGE REPLACEMENT LOGIC HERE >>>>
        // Example of what to do:
        // const zip = new PizZip(buffer);
        // const imageModule = new ImageModule({ ... });
        // const doc = new Docxtemplater(zip, { modules: [imageModule] });
        // const templateData = { ... }; // map images to placeholders
        // doc.setData(templateData);
        // doc.render();
        // buffer = doc.getZip().generate({ type: 'nodebuffer' });
      }

      // STAGE 2: Replace Text
      const zipForText = new PizZip(buffer);
      const docForText = new Docxtemplater(zipForText, {
        delimiters: { start: '[', end: ']' },
        linebreaks: true,
        nullGetter: () => '',
      });

      const { templateData, replacementCount } = await prepareTextData(data);
      docForText.setData(templateData);
      
      try {
        docForText.render();
      } catch (error: any) {
        console.error('Docxtemplater text rendering error:', JSON.stringify(error, null, 2));
        let errorMessage = 'Failed to render the document due to a template error.';
        if (error.properties && error.properties.errors) {
          const firstError = error.properties.errors[0];
          errorMessage += ` Details: ${firstError.properties.explanation} (ID: ${firstError.id})`;
        }
        throw new Error(errorMessage);
      }

      const outputBuffer = docForText.getZip().generate({
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
