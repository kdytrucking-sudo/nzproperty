'use server';
/**
 * @fileOverview A Genkit flow to test image replacement in a .docx template.
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

// This is a custom parser for docxtemplater that handles image data.
// It looks for a placeholder and returns the image data in a format
// that docxtemplater can understand, without needing an external module.
const imageDataParser = (tag: string) => {
    if (tag.startsWith('image_')) {
        return {
            _type: "image",
            module: "open-xml-templating/docxtemplater-image-module",
            source: (scope: any) => {
                // The 'scope' is the data object passed to doc.setData()
                // We expect the image data to be a base64 string on the scope object.
                const imageBase64 = scope[tag];
                if (!imageBase64 || typeof imageBase64 !== 'string') {
                    return new (Docxtemplater as any).Errors.XTError("Image data not found or invalid for tag " + tag);
                }
                // Remove the data URI prefix (e.g., "data:image/png;base64,")
                return Buffer.from(imageBase64.split(',')[1], 'base64');
            },
            // This part is important for resizing. The size will be taken from the placeholder image in the template.
            formatter: (tag: string, scope: any) => {
                 const image = scope[tag];
                 return image;
            },
        };
    }
    return null;
};


export async function testImageReplacement(
  input: TestImageReplacementInput
): Promise<TestImageReplacementOutput> {
  return testImageReplacementFlow(input);
}

const testImageReplacementFlow = ai.defineFlow(
  {
    name: 'testImageReplacementFlow',
    inputSchema: TestImageReplacementInputSchema,
    outputSchema: TestImageReplacementOutputSchema,
  },
  async ({ templateDataUri, imageDataUri, placeholder }) => {
    try {
      // 1. Decode template from data URI
      const templateBuffer = Buffer.from(templateDataUri.split(',')[1], 'base64');

      const zip = new PizZip(templateBuffer);

      const doc = new Docxtemplater(zip, {
        // Use the custom parser we defined above
        parser: imageDataParser,
        // The paragraphLoop setting is recommended when using images.
        paragraphLoop: true,
        linebreaks: true,
      });
      
      // 2. Prepare data for the template
      // The key must match the placeholder text inside the delimiters, without the '{}'
      // e.g., for placeholder {image_placeholder}, key is 'image_placeholder'
      const placeholderKey = placeholder.replace(/\{|\}/g, '');
      const templateData = {
        [placeholderKey]: imageDataUri // Pass the full data URI
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
