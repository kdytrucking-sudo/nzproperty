'use server';
/**
 * @fileOverview A Genkit flow to test image replacement in a .docx template.
 * This version uses a custom parser and does not require external image modules.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const TestImageReplacementInputSchema = z.object({
  templateDataUri: z.string().describe('The .docx template file as a data URI.'),
  imageDataUri: z.string().describe('The image file to insert as a data URI.'),
  placeholder: z.string().describe('The placeholder text in the template, e.g., {image_placeholder}'),
});
export type TestImageReplacementInput = z.infer<typeof TestImageReplacementInputSchema>;

const TestImageReplacementOutputSchema = z.object({
  generatedDocxDataUri: z.string().describe('The generated .docx file as a data URI.'),
});
export type TestImageReplacementOutput = z.infer<typeof TestImageReplacementOutputSchema>;


export async function testImageReplacement(
  input: TestImageReplacementInput
): Promise<TestImageReplacementOutput> {
  return testImageReplacementFlow(input);
}

// Custom parser to handle image tags
const imageDataParser = (tag: string) => {
  if (tag.startsWith('image_')) {
    return {
      get(scope: any) {
        // 'scope' is the data object passed to doc.setData()
        // We expect the image data to be in scope.image
        if (tag === 'image_placeholder') {
          return scope.image;
        }
        return undefined;
      },
    };
  }
  return null;
};


const testImageReplacementFlow = ai.defineFlow(
  {
    name: 'testImageReplacementFlow',
    inputSchema: TestImageReplacementInputSchema,
    outputSchema: TestImageReplacementOutputSchema,
  },
  async ({ templateDataUri, imageDataUri, placeholder }) => {
    try {
      // 1. Decode template and image from data URIs
      const templateBuffer = Buffer.from(templateDataUri.split(',')[1], 'base64');
      const imageBase64 = imageDataUri.split(',')[1];
      const zip = new PizZip(templateBuffer);
      
      const doc = new Docxtemplater(zip, {
        // No external modules needed
        paragraphLoop: true,
        linebreaks: true,
      });
      
      // 2. Prepare data for the template
      // The key in the data object must match the placeholder in the template.
      // The value is the base64 encoded image data.
      const placeholderKey = placeholder.replace(/\{|\}/g, '');
      const templateData = {
        [placeholderKey]: imageBase64
      };

      doc.setData(templateData);

      // 3. Render the document
      doc.render();

      // 4. Generate the output file
      const outputBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      const outputBase64 = outputBuffer.toString('base64');
      const outputDataUri =
        `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${outputBase64}`;

      return {
        generatedDocxDataUri: outputDataUri,
      };

    } catch (error: any) {
      console.error('Error during image replacement test:', error);
      let errorMessage = 'Failed to process the document.';
       if (error.properties && error.properties.errors) {
         const firstError = error.properties.errors[0];
         errorMessage += ` Details: ${firstError.properties.explanation} (ID: ${firstError.id})`;
       } else {
         errorMessage = error.message;
       }
       throw new Error(errorMessage);
    }
  }
);
