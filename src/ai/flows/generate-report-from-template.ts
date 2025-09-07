
'use server';
/**
 * @fileOverview Generates a .docx report from a template using docxtemplater.
 * This flow handles text and image replacement using the built-in parser.
 *
 * - generateReportFromTemplate - The main function to generate the report.
 * - GenerateReportInput - The input type for the generation function.
 * - GenerateReportOutput - The return type for the generation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

/* -----------------------------
 * Schemas
 * ----------------------------- */

const GenerateReportInputSchema = z.object({
  templateFileName: z.string().describe('The file name of the .docx template stored on the server.'),
  data: z.any().describe('A JSON object containing key-value pairs for text and image replacement.'),
});
export type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

const GenerateReportOutputSchema = z.object({
  generatedDocxDataUri: z.string().describe('The generated .docx file as a data URI.'),
  replacementsCount: z.number().describe('The count of replacements made.'),
});
export type GenerateReportOutput = z.infer<typeof GenerateReportOutputSchema>;


/**
 * Custom parser to handle image data URIs.
 * Docxtemplater's built-in image module is often paid or has issues.
 * This parser allows using a simple tag like {%image_placeholder_tag}
 * and passing the base64 data URI directly in the data object.
 */
const imageDataParser = (tag: string) => {
  if (tag.startsWith('image_placeholder_')) {
    return {
      get(scope: any) {
        if (tag === '.') {
          return scope;
        }
        // Check if the tag exists in the current scope
        if (scope[tag]) {
           // Return an object that docxtemplater understands for image replacement
           return {
             _type: "image",
             source: scope[tag], // Expects a base64 data URI
             format: "image/png" // Or other format
           };
        }
        return scope[tag];
      },
    };
  }
  return null; // Let the default parser handle other tags
}


/* -----------------------------
 * Flow
 * ----------------------------- */
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
      const templateContent = await fs.readFile(templatePath);
      const zip = new PizZip(templateContent);

      // Clean up the image data URI if it exists
      const imageTag = 'image_placeholder_NatureofProperty1';
      if (data[imageTag] && typeof data[imageTag] === 'string' && data[imageTag].startsWith('data:')) {
        data[imageTag] = data[imageTag].split(',')[1];
      }

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        // The key change: use a custom parser for image tags
        parser: (tag) => {
          if (tag === imageTag) {
            return {
              get: (scope) => scope[tag],
              _render: (scope) => {
                if (scope[tag]) {
                  return {
                    type: "image",
                    value: Buffer.from(scope[tag], "base64"),
                    options: {},
                  };
                }
                return { type: "replace", value: "" };
              },
            };
          }
          return null;
        },
      });

      doc.setData(data);

      doc.render();

      const outputBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });
      
      const outputBase64 = outputBuffer.toString('base64');
      const outputDataUri =
        `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${outputBase64}`;

      const replacementsCount = Object.keys(data).length;

      return {
        generatedDocxDataUri: outputDataUri,
        replacementsCount,
      };

    } catch (error: any) {
      console.error(`Error processing template ${templateFileName}:`, error);
      if (error.properties && error.properties.errors) {
        const errorDetails = error.properties.errors.map((e: any) => e.properties.explanation).join(', ');
        throw new Error(`Template error: ${errorDetails}`);
      }
      throw new Error(error.message || 'Failed to generate the document.');
    }
  }
);
