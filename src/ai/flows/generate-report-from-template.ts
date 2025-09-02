'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a report from a Word template.
 *
 * - `generateReportFromTemplate` - A function that fills a .docx template with provided data.
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
  templateFileName: z.string().describe('The file name of the .docx template stored on the server.'),
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

// Custom parser to handle different delimiters
const parser = (tag: string) => {
    return {
        get(scope: any) {
            // Allow for tags like [Name] and [Replace_Name]
            if (tag.startsWith('Replace_')) {
                const key = tag.substring(8);
                return scope[key] || scope[tag];
            }
             // Allow for tags like [TermText_Name]
            if (tag.startsWith('TermText_')) {
                 const key = tag.substring(9);
                 return scope[tag] || scope[key];
            }
            // Fallback for simple tags like [Name]
            return scope[tag];
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
  async ({ templateFileName, data }) => {
    const templatesDir = path.join(process.cwd(), 'src', 'lib', 'templates');
    const templatePath = path.join(templatesDir, templateFileName);

    try {
        const buffer = await fs.readFile(templatePath);
        const zip = new PizZip(buffer);

        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          parser: parser,
          delimiters: {
            start: '[',
            end: ']',
          },
          nullGetter: () => "", // Return empty string for missing values
        });
        
        const templateData: { [key:string]: any } = {};
        let replacementCount = 0;

        // Flatten the nested data object for simple replacements
        function flatten(obj: any, path: string = '') {
          for (const key in obj) {
            if (key === 'comparableSales' && Array.isArray(obj[key])) {
                templateData['comparableSales'] = obj[key];
                if(obj[key].length > 0) replacementCount++;
                continue;
            }

            // Keep TermText keys at the top level
            if(key.startsWith('TermText_')) {
                templateData[key] = obj[key];
                if (obj[key] && obj[key] !== 'N/A' && obj[key] !== '') {
                    replacementCount++;
                }
                continue;
            }

            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
              flatten(obj[key], path ? `${path}_${key}`: key);
            } else {
              const finalKey = path ? `Replace_${path}_${key}` : `Replace_${key}`;
              templateData[finalKey] = obj[key];
              // Count valid, non-placeholder replacements
              if (obj[key] && typeof obj[key] === 'string' && !obj[key].startsWith('[extracted_') && obj[key] !== 'N/A' && obj[key] !== '') {
                replacementCount++;
              }
            }
          }
        }
        flatten(data);

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
    } catch (error: any) {
        console.error(`Error reading template file ${templateFileName}:`, error);
        if(error.code === 'ENOENT') {
            throw new Error(`Template file "${templateFileName}" not found on the server.`);
        }
        throw new Error(`Failed to read or process the template file.`);
    }
  }
);
