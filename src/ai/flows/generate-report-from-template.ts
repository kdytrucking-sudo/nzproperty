'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a report from a Word template.
 *
 * - `generateReportFromTemplate` - A function that fills a .docx template with provided data.
 * - `GenerateReportInput` - The input type for the `generateReportFromTemplate` function.
 * - `GenerateReportOutput` - The return type for the `generateReportFromTemplate` function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const GenerateReportInputSchema = z.object({
  templateDataUri: z
    .string()
    .describe(
      "The .docx template file as a data URI. Expected format: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,<encoded_data>'."
    ),
  data: z.any().describe('The JSON data to populate the template with.'),
});
export type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

const GenerateReportOutputSchema = z.object({
  generatedDocxDataUri: z
    .string()
    .describe('The generated .docx file as a data URI.'),
  replacementsCount: z.number().describe('The number of placeholders that were replaced.'),
});
export type GenerateReportOutput = z.infer<typeof GenerateReportOutputSchema>;

// Custom parser to handle [Replace_xxxx] syntax
const customParser = (tag: string) => {
    return {
        get(scope: any) {
            if (tag === '.') {
                return scope;
            }
            if (scope[tag]) {
                return scope[tag];
            }
            return undefined;
        },
    };
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
  async ({ templateDataUri, data }) => {
    // 1. Decode the base64 template
    const base64Content = templateDataUri.split(',')[1];
    const buffer = Buffer.from(base64Content, 'base64');

    // 2. Load the document with PizZip
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      // Use custom parser for [Replace_xxxx] format
      parser: (tag) => {
        const cleanedTag = tag.replace(/^Replace_/, '');
        return {
          get: (scope) => {
            if (scope[`Replace_${cleanedTag}`]) {
              return scope[`Replace_${cleanedTag}`];
            }
            // To handle nested loops like [comparableSales]...[/comparableSales]
            if (scope[cleanedTag]) {
                return scope[cleanedTag];
            }
            return `[${tag}]`; // Keep placeholder if not found
          },
        };
      },
      delimiters: {
        start: '[',
        end: ']',
      },
      // Handle cases where data is missing for a placeholder
      nullGetter: () => "N/A", 
    });
    
    // Flatten the data and add 'Replace_' prefix
    const flattenedData: { [key: string]: any } = {};
    let replacementCount = 0;

    function flatten(obj: any, path: string[] = []) {
      for (const key in obj) {
        if (key === 'comparableSales' && Array.isArray(obj[key])) {
            flattenedData['comparableSales'] = obj[key];
            replacementCount++; // Count the loop block as one replacement
            continue;
        }

        const newPath = path.concat(key);
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          flatten(obj[key], newPath);
        } else {
          const finalKey = `Replace_${key}`;
          flattenedData[finalKey] = obj[key];
          if (obj[key] !== `[extracted_${key}]` && obj[key] !== 'N/A' && obj[key] !== '') {
            replacementCount++;
          }
        }
      }
    }
    flatten(data);

    // 3. Set the data
    doc.setData(flattenedData);

    try {
      // 4. Render the document (replace placeholders)
      doc.render();
    } catch (error: any) {
      console.error('Docxtemplater error:', error);
      // This helps in debugging template issues
      if (error.properties && error.properties.errors) {
        error.properties.errors.forEach((err: any) => {
          console.error('Template Error Details:', err);
        });
      }
      throw new Error('Failed to render the document. Check template placeholders and data structure.');
    }

    // 5. Get the output as a buffer
    const outputBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // 6. Convert the buffer back to a data URI
    const outputBase64 = outputBuffer.toString('base64');
    const outputDataUri = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${outputBase64}`;

    return {
      generatedDocxDataUri: outputDataUri,
      replacementsCount: replacementCount,
    };
  }
);
