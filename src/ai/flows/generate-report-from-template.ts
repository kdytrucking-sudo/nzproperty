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
  // This is a simple check for image tags based on Alt Text
  if (tag.startsWith('Image')) {
     return {
        get: (scope: any) => scope[tag],
     };
  }
  return {
    get: (scope: any) => scope[tag],
  };
};

const imageModule = {
    name: "ImageModule",
    prefix: "[",
    link: "word/media/image",
    build(tag: string) {
        if (tag.startsWith("Image")) {
            return {
                type: "image",
                tag,
            };
        }
        return null;
    },
    render(part: any, scope: any) {
        if (part.type !== "image") {
            return null;
        }

        const image = scope[part.tag];

        if (image) {
            const base64Data = image.split(',')[1];
            if (base64Data) {
                return {
                    type: "image",
                    value: Buffer.from(base64Data, "base64"),
                };
            }
        }
        // If no image is provided, remove the placeholder tag by returning an empty text object
        return { type: "text", value: "" };
    }
};

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
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
      parser: (tag) => {
        // This parser handles Alt Text placeholders like `[Image1]`
        if (tag.startsWith('[') && tag.endsWith(']')) {
            const tagName = tag.substring(1, tag.length - 1);
            return customParser(tagName);
        }
        return customParser(tag);
      },
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
    if (photos) {
        photos.forEach((photoDataUri, index) => {
            const imageKey = `Image${index + 1}`; // This matches [Image1], [Image2] etc.
            flattenedData[imageKey] = photoDataUri;
            replacementCount++;
        });
    }
    
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
