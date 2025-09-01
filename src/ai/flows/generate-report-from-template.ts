'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a report from a Word template.
 *
 * - `generateReportFromTemplate` - A function that fills a .docx template with provided data, including images.
 * - `GenerateReportInput` - The input type for the `generateReportFromTemplate` function.
 * - `GenerateReportOutput` - The return type for the `generateReportFromTemplate` function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import mammoth from 'mammoth';

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

// A custom module for docxtemplater to handle image replacement and cleanup.
const imageReplaceModule = {
    name: "ImageReplaceModule",
    on(event: string, name: string, context: any) {
        if (event === "syncing-zip") {
            const { zip, Txtgen } = context;
            const doc = Txtgen.parser.postparsed.reduce((acc: any, { value }: any) => acc + value, "");

            // Regex to find all [ImageX] placeholders
            const imagePlaceholders = [...doc.matchAll(/\[Image(\d+)\]/g)].map(m => parseInt(m[1]));
            const maxImageIndex = imagePlaceholders.length > 0 ? Math.max(...imagePlaceholders) : 0;
            
            const uploadedImageCount = Txtgen.scope.photos ? Txtgen.scope.photos.length : 0;

            // Remove leftover image placeholders if not enough images were uploaded
            if (uploadedImageCount < maxImageIndex) {
                for (let i = uploadedImageCount + 1; i <= maxImageIndex; i++) {
                    const placeholder = `[Image${i}]`;
                    // This is a simplified way to remove the placeholder text.
                    // A more robust solution might involve direct XML manipulation if this fails.
                     Object.keys(zip.files).forEach(fileName => {
                        if (fileName.endsWith('.xml')) {
                            let content = zip.files[fileName].asText();
                            content = content.replace(new RegExp(placeholder.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), '');
                            zip.file(fileName, content);
                        }
                    });
                }
            }
        }
    },
    get(scope: any, context: any) {
        // Handle [ImageX] for alt text based replacement
        if (context.tag.startsWith("Image")) {
             const index = parseInt(context.tag.substring(5), 10); // get X from ImageX
             if (scope.photos && scope.photos[index - 1]) {
                const base64Data = scope.photos[index - 1].split(',')[1];
                 return {
                     _type: "image",
                     source: Buffer.from(base64Data, 'base64'),
                     format: scope.photos[index - 1].substring(scope.photos[index - 1].indexOf('/') + 1, scope.photos[index - 1].indexOf(';')),
                 };
             }
        }
        return undefined;
    }
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
  async ({ templateDataUri, data, photos }) => {
    // 1. Decode the base64 template
    const base64Content = templateDataUri.split(',')[1];
    const buffer = Buffer.from(base64Content, 'base64');

    // 2. Load the document with PizZip
    const zip = new PizZip(buffer);
    
    // Custom parser for [Replace_xxxx] format
    const customParser = (tag: string) => {
        // This parser now only handles the simple text replacement logic.
        // It's designed to find keys like `Replace_xxxx` in the flattened data scope.
        if (tag.startsWith("Replace_")) {
            return {
                get: (scope: any) => {
                    // Check if the exact key exists in the scope, e.g., scope['Replace_xxxx']
                    if (scope[tag]) {
                        return scope[tag];
                    }
                    return `[${tag}]`; // Keep placeholder if not found
                },
            };
        }
        // Handle loop syntax like [comparableSales]...[/comparableSales]
        if (tag.startsWith('#')) {
             return {
                type: "loop",
                start: "#",
                end: "/",
                get: (scope:any) => scope[tag.substring(1)] || [],
            };
        }
        if (tag.startsWith('/')) {
             return {
                type: "end-loop",
                start: "#",
                end: "/",
            };
        }
        // For keys inside a loop
        return {
            get: (scope: any) => scope[tag],
        }
    };
    
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      parser: customParser,
      delimiters: {
        start: '[',
        end: ']',
      },
      // Handle cases where data is missing for a placeholder
      nullGetter: () => "N/A", 
      // The image module is not used here as we are using a custom solution.
      // Instead, we will handle image replacement through alt text.
      // We will look for [ImageX] in the alt text of images.
       modules: [{
            name: "ImageAltTextModule",
            set(options: any) {
                options.Lexer.configure({ ...options.Lexer.options, altText: true });
            },
            get(scope: any, context: any) {
                 if (context.tag === 'Image' && context.altText) {
                    const match = context.altText.match(/^\[Image(\d+)\]$/);
                    if (match) {
                        const index = parseInt(match[1], 10) - 1; // [Image1] -> index 0
                        if (photos && photos[index]) {
                            const photoDataUri = photos[index];
                            const base64Data = photoDataUri.split(',')[1];
                             return {
                                _type: "image",
                                source: Buffer.from(base64Data, "base64"),
                                format: photoDataUri.substring(photoDataUri.indexOf("/") + 1, photoDataUri.indexOf(";base64")),
                            };
                        } else {
                             // If no image is provided for this placeholder, remove the placeholder image
                             return ""; // This should remove the image tag.
                        }
                    }
                }
                return undefined;
            }
        }]
    });
    
    // Flatten the data and add 'Replace_' prefix
    const flattenedData: { [key:string]: any } = {};
    let replacementCount = 0;

    function flatten(obj: any, path: string[] = []) {
      for (const key in obj) {
        const newPath = path.concat(key);
        if (key === 'comparableSales' && Array.isArray(obj[key])) {
            flattenedData['comparableSales'] = obj[key];
            replacementCount++; // Count the loop block as one replacement
            continue;
        }

        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          flatten(obj[key], newPath);
        } else {
          const finalKey = `Replace_${key}`;
          flattenedData[finalKey] = obj[key];
          // Count only actual replacements, not placeholders or empty values
          if (obj[key] && typeof obj[key] === 'string' && !obj[key].startsWith('[extracted_') && obj[key] !== 'N/A' && obj[key] !== '') {
            replacementCount++;
          }
        }
      }
    }
    flatten(data);

    // Add photos to the data scope
    flattenedData.photos = photos?.map(p => {
        const base64Data = p.split(',')[1];
        return base64Data;
    });
    if (photos) {
        replacementCount += photos.length;
    }


    // 3. Set the data
    doc.setData(flattenedData);

    try {
      // 4. Render the document (replace placeholders)
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
