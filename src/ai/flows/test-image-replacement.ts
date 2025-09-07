
'use server';
/**
 * @fileOverview A Genkit flow for testing image replacement in a .docx template.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs/promises';
import path from 'path';
import { ImageOptionsSchema, type ImageConfig } from '@/lib/image-options-schema';

const ImageModule = require('docxtemplater-image-module-free');

/* -----------------------------
 * Schemas
 * ----------------------------- */

const TestImageReplacementInputSchema = z.object({
  templateDataUri: z.string().describe('The .docx template file as a data URI.'),
  imagesData: z.record(z.string(), z.string()).describe('A map of image placeholders to their data URIs.'),
});

const TestImageReplacementOutputSchema = z.object({
  generatedDocxDataUri: z.string().describe('The generated .docx file as a data URI.'),
  replacementsCount: z.number().describe('The number of image placeholders that were replaced.'),
});

export type TestImageReplacementInput = z.infer<typeof TestImageReplacementInputSchema>;
export type TestImageReplacementOutput = z.infer<typeof TestImageReplacementOutputSchema>;

/* -----------------------------
 * Flow
 * ----------------------------- */

export async function testImageReplacement(
  input: TestImageReplacementInput
): Promise<TestImageReplacementOutput> {
  return testImageReplacementFlow(input);
}

const testImageReplacementFlow = ai.defineFlow(
  {
    name: 'testImageReplacementFlow',
    inputSchema: TestImageReplacementInputSchema,
    outputSchema: TestImageReplacementOutputSchema,
  },
  async ({ templateDataUri, imagesData }) => {
    try {
      // 1. Prepare image module and configurations
      const imageOptionsPath = path.join(process.cwd(), 'src', 'lib', 'image-options.json');
      const imageOptionsJson = await fs.readFile(imageOptionsPath, 'utf-8');
      const imageConfigs = ImageOptionsSchema.parse(JSON.parse(imageOptionsJson));
      
      const imageSizeMap = new Map<string, { width: number; height: number }>();
      imageConfigs.forEach((config: ImageConfig) => {
        // Key is placeholder WITHOUT delimiters, e.g., "Image_NatureofProperty1"
        const key = config.placeholder.replace(/\{%|\[%|%\]|%}|}/g, '');
        imageSizeMap.set(key, { width: config.width, height: config.height });
      });

      const imageModule = new ImageModule({
        fileType: 'docx',
        centered: false,
        getImage(tagValue: string) {
          const base64 = tagValue.split(',')[1] ?? '';
          return Buffer.from(base64, 'base64');
        },
        getSize(_img: Buffer, _tagValue: string, tagName: string) {
            // tagName is the placeholder key without delimiters
            const size = imageSizeMap.get(tagName);
            return size ? [size.width, size.height] : [300, 200]; // fallback size
        },
      });

      // 2. Load template from data URI
      const base64Content = templateDataUri.split(',')[1];
      const templateBuffer = Buffer.from(base64Content, 'base64');
      const zip = new PizZip(templateBuffer);
      
      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        // IMPORTANT: Use the correct delimiters for image replacement.
        // The free image module ONLY works with the default '{%...}' syntax.
        // We will NOT set custom delimiters here, so it uses its default.
      });

      // 3. Prepare data for the template
      const templateData: Record<string, string> = {};
      let replacementsCount = 0;
      Object.entries(imagesData).forEach(([placeholder, dataUri]) => {
          if (dataUri) {
              // The key in templateData must match the placeholder in the document,
              // but WITHOUT the delimiters.
              const key = placeholder.replace(/\{%|\}/g, '');
              templateData[key] = dataUri;
              replacementsCount++;
          }
      });
      
      // 4. Render the document
      doc.setData(templateData);
      doc.render();

      // 5. Generate and return the final document
      const finalBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });
      
      const finalBase64 = finalBuffer.toString('base64');
      const finalDataUri = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${finalBase64}`;

      return {
        generatedDocxDataUri: finalDataUri,
        replacementsCount: replacementsCount,
      };

    } catch (error: any) {
      console.error(`Error in testImageReplacementFlow:`, error);
      // Check for docxtemplater-specific errors
      if (error.properties && error.properties.errors) {
          const firstError = error.properties.errors[0];
          const explanation = firstError.properties.explanation || `Unexplained error with placeholder: ${firstError.properties.id}`;
          throw new Error(`Template render error: ${explanation}`);
      }
      throw new Error(error.message || 'Failed to process the template file.');
    }
  }
);
