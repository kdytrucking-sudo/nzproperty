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

    // Helper to recursively process the JSON structure and map data.
    const processExtractedData = (structure: any, dataAtPath: any) => {
        if (!structure || !dataAtPath) return;

        Object.keys(structure).forEach(key => {
            const structureValue = structure[key];
            const dataValue = dataAtPath[key];

            if (typeof structureValue === 'object' && structureValue !== null && !Array.isArray(structureValue)) {
                // For nested objects (like 'Property', 'DIY'), recurse deeper
                processExtractedData(structureValue, dataValue);
            } else if (typeof structureValue === 'string' && structureValue.startsWith('[extracted_')) {
                // This is a field to be replaced.
                // Transform placeholder from '[extracted_XXXX]' to 'Replace_XXXX'
                const placeholder = structureValue.replace('[extracted_', 'Replace_').replace(']', '');
                templateData[placeholder] = dataValue;
                if (dataValue && typeof dataValue === 'string' && dataValue.trim() !== '' && dataValue !== 'N/A') {
                    replacementCount++;
                }
            }
        });
    };

    // 1. Process PDF-extracted data based on json-structure.json mapping
    processExtractedData(initialJsonStructure, data);

    // 2. Process global content from manage-content page
    contentFields.forEach(field => {
        // The key in the template is '[Replace_NZEconomic]', so the key for docxtemplater is 'Replace_NZEconomic'
        const templateKey = field.templateKey.replace(/\[|\]/g, ''); 
        const contentValue = globalContent[field.name as keyof typeof globalContent];
        templateData[templateKey] = contentValue;
         if (contentValue && contentValue.trim() !== '') {
            replacementCount++;
        }
    });

    // 3. Process comparableSales as a loopable array for {#comparableSales} tag
    // The placeholders inside the loop are {compAddress}, {compSaleDate} etc., NOT {Replace_compAddress}
    // So we pass the array as is.
    if (data.comparableSales && Array.isArray(data.comparableSales)) {
        templateData['comparableSales'] = data.comparableSales;
        if(data.comparableSales.length > 0) replacementCount++; // Count the loop as one replacement
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
          nullGetter: () => "", // Return empty string for missing values
        });
        
        const { templateData, replacementCount } = prepareTemplateData(data);
        
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
