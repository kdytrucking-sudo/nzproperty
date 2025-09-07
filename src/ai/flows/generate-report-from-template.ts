
'use server';
/**
 * Generates a Word document from a template, filling in text and image placeholders.
 * This flow now operates in two sequential stages to ensure reliability:
 * 1. Image Replacement: First, it processes and inserts all images into the template.
 * 2. Text Replacement: Second, it takes the document with images and replaces all text placeholders.
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
  data: z.any().describe('The JSON data to populate the template with.'),
  images: z.record(z.string(), z.string()).optional().describe('A map of image placeholders to their data URIs.'),
});
export type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

const GenerateReportOutputSchema = z.object({
  generatedDocxDataUri: z.string().describe('The generated .docx file as a data URI.'),
  replacementsCount: z.number().describe('The number of placeholders that were replaced.'),
});
export type GenerateReportOutput = z.infer<typeof GenerateReportOutputSchema>;


/* -----------------------------
 * Data preparation for Docxtemplater (TEXT ONLY)
 * ----------------------------- */
const normalizeNewlines = (s: unknown): string =>
  s !== undefined && s !== null
    ? String(s).replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    : '';

const prepareTextData = async (data: any) => {
    const templateData: Record<string, any> = {};
    let replacementCount = 0;

    const jsonStructurePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
    const jsonString = await fs.readFile(jsonStructurePath, 'utf-8');
    const jsonStructure = JSON.parse(jsonString);

    const countAndSetReplacement = (key: string, value: any): void => {
        const normalizedValue = normalizeNewlines(value);
        templateData[key] = normalizedValue;

        if (value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== 'N/A') {
            replacementCount++;
        }
    };
  
    // Process sections from json-structure.json
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

    // Process commentary section
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

    // Process other specific sections
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

    // Process multi-option briefs
    if (data?.multiOptionBriefs) {
        const multiOptions = await getMultiOptions();
        multiOptions.forEach(card => {
            const placeholderKey = card.placeholder.replace(/\[|\]/g, '');
            const brief = data.multiOptionBriefs[card.id];
            if (brief) {
                countAndSetReplacement(placeholderKey, brief);
            }
        });
    }
    
    // Process comparable sales loop
    if (Array.isArray(data?.comparableSales)) {
        templateData['comparableSales'] = data.comparableSales.map((sale: Record<string, any>) => {
          const n: Record<string, any> = {};
          Object.keys(sale).forEach((k: string) => {
            const v = sale[k] ?? '';
            n[k] = normalizeNewlines(v);
          });
          return n;
        });
        // Count the loop as one replacement if it has content
        if (data.comparableSales.length > 0) {
            replacementCount++;
        }
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


// Asynchronously load multi-options once
const getMultiOptions = (() => {
  let promise: Promise<any> | null = null;
  return () => {
    if (!promise) {
      promise = fs.readFile(path.join(process.cwd(), 'src', 'lib', 'multi-options.json'), 'utf-8').then(JSON.parse);
    }
    return promise;
  };
})();


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
      const templateBuffer = await fs.readFile(templatePath);
      let bufferWithImages = templateBuffer;
      let imageReplacements = 0;

      // STAGE 1: Replace Images
      if (images && Object.keys(images).length > 0) {
          const imageOptionsPath = path.join(process.cwd(), 'src', 'lib', 'image-options.json');
          const imageOptionsJson = await fs.readFile(imageOptionsPath, 'utf-8');
          const imageConfigs = ImageOptionsSchema.parse(JSON.parse(imageOptionsJson));
          
          const imageSizeMap = new Map<string, { width: number; height: number }>();
          imageConfigs.forEach(config => {
              const key = config.placeholder.trim().replace(/^\[\%/, '').replace(/\]$/, '');
              imageSizeMap.set(key, { width: config.width, height: config.height });
          });

          const imageModule = new ImageModule({
              fileType: 'docx',
              centered: false,
              // The tag to look for inside the delimiters: [%tag]
              tag: '%',
              getImage(tagValue: unknown) {
                  if (Buffer.isBuffer(tagValue)) return tagValue;
                  if (typeof tagValue === 'string' && tagValue.startsWith('data:')) {
                      const b64 = tagValue.split(',')[1] ?? '';
                      return Buffer.from(b64, 'base64');
                  }
                  return null;
              },
              getSize(_img: Buffer, _tagValue: unknown, tagName: string) {
                  const size = imageSizeMap.get(tagName);
                  return size ? [size.width, size.height] : [300, 200];
              },
          });

          const zip = new PizZip(templateBuffer);
          const doc = new Docxtemplater(zip, {
              modules: [imageModule],
              delimiters: { start: '[', end: ']' },
          });

          const imageDataForTemplate: Record<string, string> = {};
          Object.entries(images).forEach(([placeholder, dataUri]) => {
              if (dataUri) {
                  const key = placeholder.trim().replace(/^\[\%/, '').replace(/\]$/, '');
                  imageDataForTemplate[key] = dataUri;
                  imageReplacements++;
              }
          });

          doc.setData(imageDataForTemplate);
          doc.render();

          bufferWithImages = doc.getZip().generate({ type: 'nodebuffer' });
      }

      // STAGE 2: Replace Text
      const zipForText = new PizZip(bufferWithImages);
      const docForText = new Docxtemplater(zipForText, {
          paragraphLoop: true,
          delimiters: { start: '[', end: ']' },
      });

      const { templateData: textData, replacementCount: textReplacements } = await prepareTextData(data);
      docForText.setData(textData);
      docForText.render();

      const finalBuffer = docForText.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });
      
      const finalBase64 = finalBuffer.toString('base64');
      const finalDataUri = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${finalBase64}`;

      return {
        generatedDocxDataUri: finalDataUri,
        replacementsCount: imageReplacements + textReplacements,
      };

    } catch (error: any) {
      console.error(`Error processing template file ${templateFileName}:`, error);
      if (error.properties && error.properties.errors) {
          const firstError = error.properties.errors[0];
          const explanation = firstError.properties.explanation || `Unexplained error with placeholder: ${firstError.properties.id}`;
          throw new Error(`Template render error: ${explanation}`);
      }
      if (error.code === 'ENOENT') {
          throw new Error(`Template file "${templateFileName}" not found.`);
      }
      throw new Error(error.message || 'Failed to read or process the template file.');
    }
  }
);
