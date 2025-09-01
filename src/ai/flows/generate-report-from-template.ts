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

const imageModule = {
    name: "ImageModule",
    prefix: "", // No prefix, we will match the whole tag
    link: "word/media/image",
    build(tag: string) {
        // This regex will match tags starting with "Image" followed by a number, e.g., Image1, Image22
        if (/^Image\d+$/.test(tag)) {
            return {
                type: "image",
                tag: tag, // The tag is the full Alt Text, e.g., "Image1"
            };
        }
        return null;
    },
    render(part: any, scope: any) {
        if (part.type !== "image") {
            return null;
        }

        const image = scope[part.tag]; // scope['Image1']

        if (image) {
            // Remove the data URI prefix if it exists
            const base64Data = image.split(',')[1];
            if (base64Data) {
                // Return the image data as a buffer
                return {
                    type: "image",
                    value: Buffer.from(base64Data, "base64"),
                    // You can also specify size here if needed, e.g.,
                    // size: [600, 400], 
                };
            }
        }
        // If no image is provided for the placeholder, remove the tag by returning an empty text object
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
      modules: [imageModule], // Use the image module
      paragraphLoop: true,
      linebreaks: true,
      // Custom parser to handle [Replace_...] and other tags.
      parser: (tag) => {
        return {
          get(scope, context) {
            if (tag.startsWith('Replace_')) {
                return scope[tag];
            }
            if (tag === 'comparableSales') {
                return scope.comparableSales;
            }
            if (tag.startsWith('Image')) {
                return scope[tag];
            }
            return scope[tag];
          },
        };
      },
      delimiters: {
        start: '[',
        end: ']',
      },
      nullGetter: () => "", // Return empty string for missing values
    });
    
    const templateData: { [key:string]: any } = {};
    let replacementCount = 0;

    // Flatten the nested data object and prefix keys with "Replace_"
    function flatten(obj: any) {
      for (const key in obj) {
        if (key === 'comparableSales' && Array.isArray(obj[key])) {
            templateData['comparableSales'] = obj[key];
            if(obj[key].length > 0) replacementCount++;
            continue;
        }

        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          flatten(obj[key]);
        } else {
          const finalKey = `Replace_${key}`;
          templateData[finalKey] = obj[key];
          // Count valid, non-placeholder replacements
          if (obj[key] && typeof obj[key] === 'string' && !obj[key].startsWith('[extracted_') && obj[key] !== 'N/A' && obj[key] !== '') {
            replacementCount++;
          }
        }
      }
    }
    flatten(data);

    // Prepare image data for the template. Keys must match the Alt Text.
    if (photos) {
        photos.forEach((photoDataUri, index) => {
            const imageKey = `Image${index + 1}`; // This matches Alt Text "Image1", "Image2" etc.
            templateData[imageKey] = photoDataUri;
            replacementCount++;
        });
    }
    
    doc.setData(templateData);

    try {
      doc.render();
    } catch (error: any) {
      console.error('Docxtemplater error:', error);
      if (error.properties && error.properties.errors) {
        error.properties.errors.forEach((err: any) => {
          console.error('Template Error Details:', err.properties);
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
