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
import initialJsonStructure from '@/lib/json-structure.json';
import globalContent from '@/lib/global-content.json';
import { contentFields } from '@/app/(app)/manage-content/page';

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

// This function prepares the data for docxtemplater based on the user's logic.
const prepareTemplateData = (data: any) => {
    const templateData: { [key: string]: any } = {};
    let replacementCount = 0;

    // Helper to count non-empty replacements
    const countReplacement = (value: any) => {
        if (typeof value === 'string' && value.trim() !== '' && value.trim() !== 'N/A') {
            replacementCount++;
        }
    };

    // 1. Process PDF-extracted data based on json-structure.json mapping
    Object.keys(initialJsonStructure).forEach(sectionKey => {
        const sectionSchema = initialJsonStructure[sectionKey as keyof typeof initialJsonStructure];
        const dataSection = data?.[sectionKey];

        Object.keys(sectionSchema).forEach(fieldKey => {
            const placeholder = sectionSchema[fieldKey as keyof typeof sectionSchema];
            if (typeof placeholder === 'string' && placeholder.startsWith('[extracted_')) {
                const templateKey = placeholder.replace('[extracted_', 'Replace_').replace(']', '');
                // Safely get the value from the submitted data
                const value = dataSection?.[fieldKey] || '';
                templateData[templateKey] = value;
                countReplacement(value);
            }
        });
    });
    
    // 2. Process global content from manage-content page
    contentFields.forEach(field => {
        const templateKey = field.templateKey.replace(/\[|\]/g, ''); 
        const contentValue = (globalContent as Record<string, string>)[field.name as keyof typeof globalContent] || '';
        templateData[templateKey] = contentValue;
        countReplacement(contentValue);
    });

    // 3. Process comparableSales as a loopable array for {#comparableSales} tag
    if (data.comparableSales && Array.isArray(data.comparableSales)) {
        templateData['comparableSales'] = data.comparableSales;
        if(data.comparableSales.length > 0) {
             // count each field in each sale object
            replacementCount += data.comparableSales.reduce((acc: number, sale: any) => acc + Object.values(sale).filter(v => typeof v === 'string' && v.trim() !== '' && v.trim() !== 'N/A').length, 0);
        };
    }
    
    return { templateData, replacementCount };
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
          delimiters: {
            start: '[',
            end: ']',
          },
          // Return empty string for missing values to avoid errors
          nullGetter: () => "", 
        });
        
        const { templateData, replacementCount } = prepareTemplateData(data);
        
        doc.setData(templateData);

        try {
          // This is where the magic happens.
          doc.render();
        } catch (error: any) {
          console.error('Docxtemplater rendering error:', error);
          if (error.properties && error.properties.errors) {
            error.properties.errors.forEach((err: any) => {
              console.error('Template Error Details:', err.properties);
            });
          }
          // The generic error is re-thrown to be caught by the final catch block.
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
        console.error(`Error processing template file ${templateFileName}:`, error);
        if(error.code === 'ENOENT') {
            throw new Error(`Template file "${templateFileName}" not found on the server.`);
        }
        // This is the generic error catch-all.
        throw new Error(`Failed to read or process the template file.`);
    }
  }
);
