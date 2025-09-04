
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
import { contentFields } from '@/lib/content-config';

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
const prepareTemplateData = async (data: any) => {
    const templateData: { [key: string]: any } = {};
    let replacementCount = 0;

    const countAndSetReplacement = (key: string, value: any) => {
        if (value && typeof value === 'string' && value.trim() !== '' && value.trim() !== 'N/A') {
            templateData[key] = value;
            replacementCount++;
        } else if (Array.isArray(value)) {
             templateData[key] = value;
             replacementCount++; // Count the array as one replacement
        } else {
             templateData[key] = '';
        }
    };
    
    // 1. Process PDF-extracted data based on json-structure.json mapping
    Object.keys(initialJsonStructure).forEach(sectionKey => {
        const sectionSchema = initialJsonStructure[sectionKey as keyof typeof initialJsonStructure];
        const dataSection = data?.[sectionKey];

        if (dataSection) {
             Object.keys(sectionSchema).forEach(fieldKey => {
                const placeholder = sectionSchema[fieldKey as keyof typeof sectionSchema];
                if (typeof placeholder === 'string' && placeholder.startsWith('[extracted_')) {
                    const templateKey = placeholder.replace('[extracted_', 'Replace_').replace(']', '');
                    let value = dataSection[fieldKey];
                    countAndSetReplacement(templateKey, value);
                }
            });
        }
    });

    // Add Instructed By manually as it's not in the original JSON structure for replacement
    if (data?.Valuation?.['Instructed By']) {
        countAndSetReplacement('Replace_ InstructedBy', data.Valuation['Instructed By']);
    }
    
    // 2. Process global content from manage-content page
    contentFields.forEach(field => {
        const templateKey = field.templateKey.replace(/\[|\]/g, ''); 
        let contentValue = (globalContent as Record<string, string>)[field.name as keyof typeof globalContent];
        countAndSetReplacement(templateKey, contentValue);
    });

    // 3. Process the new commentary fields
    if (data.commentary) {
      const placeholderMapping: { [key: string]: string } = {
        PreviousSale: 'Replace_PreviousSale',
        ContractSale: 'Replace_ContractSale',
        SuppliedDocumentation: 'Replace_SuppliedDoc',
        RecentOrProvided: 'Replace_RecentOrProvided',
        LIM: 'Replace_LIM',
        PC78: 'Replace_PC78',
        OperativeZone: 'Replace_Zone'
      };

      Object.keys(data.commentary).forEach(key => {
        const templateKey = placeholderMapping[key as keyof typeof placeholderMapping];
        if (templateKey) {
            let value = data.commentary[key];
            countAndSetReplacement(templateKey, value);
        }
      });
    }
    
    // 4. Process new construction brief content
    if (data.constructionBrief?.finalBrief) {
        countAndSetReplacement('Replace_ConstructionBrief', data.constructionBrief.finalBrief);
    }


    // 5. Process comparableSales as a loopable array for {#comparableSales} tag
    if (data.comparableSales && Array.isArray(data.comparableSales)) {
        templateData['comparableSales'] = data.comparableSales.map((sale: any) => {
            const newSale: { [key: string]: any } = {};
            Object.keys(sale).forEach(key => {
                const value = sale[key] || '';
                newSale[key] = value;
                 // We count replacements inside the loop for each valid field
                if (value && typeof value === 'string' && value.trim() !== '' && value.trim() !== 'N/A') {
                   replacementCount++;
                }
            });
            return newSale;
        });
    } else {
      templateData['comparableSales'] = [];
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
          delimiters: {
            start: '[',
            end: ']',
          },
          linebreaks: true,
          nullGetter: () => "", 
           // This parser will convert soft line breaks <w:br/> into hard paragraph breaks
          parser: (tag) => {
            return {
              get(scope, context) {
                if (tag === '.') {
                  return scope;
                }
                if (context.scopePath.includes(tag)) {
                  // This is a simple protection against infinite recursion
                  return '';
                }
                const value = scope[tag];
                if (value && typeof value === 'string') {
                   // Replace newline characters with the XML for a new paragraph
                   // This creates a "hard return"
                   return value.replace(/\n/g, '</w:t></w:r></w:p><w:p><w:r><w:t>');
                }
                return value;
              },
            };
          },
        });
        
        const { templateData, replacementCount } = await prepareTemplateData(data);
        
        doc.setData(templateData);

        try {
          // This is where the magic happens.
          doc.render();
        } catch (error: any) {
          console.error('Docxtemplater rendering error:', JSON.stringify(error, null, 2));
          let errorMessage = 'Failed to render the document due to a template error.';
          if (error.properties && error.properties.errors) {
            const firstError = error.properties.errors[0];
            errorMessage += ` Details: ${firstError.properties.explanation} (ID: ${firstError.id})`;
          }
          // The detailed error is re-thrown to be caught by the final catch block.
          throw new Error(errorMessage);
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
        throw new Error(error.message || `Failed to read or process the template file.`);
    }
  }
);
