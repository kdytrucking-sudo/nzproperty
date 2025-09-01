'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a report from a Word template.
 *
 * - `generateReportFromTemplate` - A function that fills a .docx template with provided data, including images.
 * - `GenerateReportInput` - The input type for the `generateReportFrom-template` function.
 * - `GenerateReportOutput` - The return type for the `generateReportFromTemplate` function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs/promises';
import path from 'path';

const GenerateReportInputSchema = z.object({
  templateDataUri: z
    .string()
    .describe(
      "The .docx template file as a data URI. Expected format: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,<encoded_data>'."
    ),
  data: z.any().describe('The JSON data to populate the template with.'),
  photos: z.array(z.string()).optional().describe('An array of photo data URIs to insert into the template.'),
});
export type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

const GenerateReportOutputSchema = z.object({
  generatedDocxDataUri: z
    .string()
    .describe('The generated .docx file as a data URI.'),
  replacementsCount: z.number().describe('The number of placeholders that were replaced.'),
});
export type GenerateReportOutput = z.infer<typeof GenerateReportOutputSchema>;

// A custom parser to handle custom delimiters and loops
const customParser = (tag: string) => {
  if (tag.startsWith('Replace_')) {
    return {
      get: (scope: any) => scope[tag] || `[${tag}]`,
    };
  }
  if (tag.startsWith('#')) {
    return {
      type: 'loop',
      start: '#',
      end: '/',
      get: (scope: any) => scope[tag.substring(1)] || [],
    };
  }
  if (tag.startsWith('/')) {
    return {
      type: 'end-loop',
      start: '#',
      end: '/',
    };
  }
   if (tag.startsWith('Image')) {
     return {
        get: (scope: any) => scope.images?.[tag],
     };
  }
  return {
    get: (scope: any) => scope[tag],
  };
};

// A custom module for handling image injection from base64 data
const imageModule = {
    name: 'ImageModule',
    prefix: 'Image',
    link: 'word/media/image',
    build(tag: any) {
        const regex = new RegExp(`^${this.prefix}(\\d+)$`);
        const match = tag.match(regex);
        if (match) {
            return {
                type: "image",
                tag: `images.${tag}`,
                value: parseInt(match[1], 10),
            };
        }
    },
    render(part: any, scope: any) {
        if (part.type !== 'image') {
            return null;
        }
        const image = scope.images?.[part.tag.substring(7)]; // e.g., get "Image1" from "images.Image1"
        if (image) {
             return {
                type: "image",
                value: image.source,
                format: `image/${image.format}`,
                // You might need to specify width/height if not inferred from template
             };
        }
        // If no image is provided for the placeholder, remove the placeholder tag
        return { type: "text", value: "" };
    }
};

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
  async ({ templateDataUri, data, photos }) => {
    // 1. Decode the base64 template
    const base64Content = templateDataUri.split(',')[1];
    const buffer = Buffer.from(base64Content, 'base64');

    const zip = new PizZip(buffer);
    
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      parser: customParser,
      delimiters: {
        start: '[',
        end: ']',
      },
      nullGetter: () => "", // Return empty string for missing values
    });
    
    const flattenedData: { [key:string]: any } = {};
    let replacementCount = 0;

    function flatten(obj: any, path: string[] = []) {
      for (const key in obj) {
        const newPath = path.concat(key);
        if (key === 'comparableSales' && Array.isArray(obj[key])) {
            flattenedData['comparableSales'] = obj[key];
            replacementCount++;
            continue;
        }

        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          flatten(obj[key], newPath);
        } else {
          const finalKey = `Replace_${key}`;
          flattenedData[finalKey] = obj[key];
          if (obj[key] && typeof obj[key] === 'string' && !obj[key].startsWith('[extracted_') && obj[key] !== 'N/A' && obj[key] !== '') {
            replacementCount++;
          }
        }
      }
    }
    flatten(data);

    // Prepare image data for the template
    const images: {[key: string]: any} = {};
    if (photos) {
        photos.forEach((photoDataUri, index) => {
            const imageKey = `Image${index + 1}`;
            const base64Data = photoDataUri.split(',')[1];
            const imageFormat = photoDataUri.substring(photoDataUri.indexOf('/') + 1, photoDataUri.indexOf(';'));
            images[imageKey] = {
                _type: "image",
                source: Buffer.from(base64Data, 'base64'),
                format: imageFormat,
            };
            replacementCount++;
        });
    }
    flattenedData.images = images;
    
    doc.setData(flattenedData);

    try {
      doc.render();
    } catch (error: any) {
      console.error('Docxtemplater error:', error);
      if (error.properties && error.properties.errors) {
        error.properties.errors.forEach((err: any) => {
          console.error('Template Error Details:', err);
        });
      }
      throw new Error('Failed to render the document. Check template placeholders and data structure.');
    }

    const outputBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const outputBase64 = outputBuffer.toString('base64');
    const outputDataUri = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${outputBase64}`;

    return {
      generatedDocxDataUri: outputDataUri,
      replacementsCount: replacementCount,
    };
  }
);
