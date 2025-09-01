'use server';
/**
 * @fileOverview Extracts property data from uploaded PDFs using Gemini API and Google Cloud Vision API for OCR.
 *
 * - extractPropertyData - A function that handles the extraction of property data from PDFs.
 * - ExtractPropertyDataInput - The input type for the extractPropertyData function.
 * - ExtractPropertyDataOutput - The return type for the extractPropertyData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import fs from 'fs/promises';
import path from 'path';

// Dynamically create the Zod schema from the JSON file
async function getOutputSchema() {
    const filePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
    const jsonString = await fs.readFile(filePath, 'utf-8');
    const jsonObject = JSON.parse(jsonString);

    function createZodSchema(obj: any): z.ZodType<any> {
        if (Array.isArray(obj)) {
            if (obj.length > 0) {
                return z.array(createZodSchema(obj[0]));
            } else {
                return z.array(z.any());
            }
        } else if (typeof obj === 'object' && obj !== null) {
            const shape: { [key: string]: z.ZodType<any> } = {};
            for (const key in obj) {
                shape[key] = createZodSchema(obj[key]);
            }
            return z.object(shape);
        } else if (typeof obj === 'string') {
            // All fields are treated as strings as per the placeholder format.
            return z.string().describe(`Extracted data for ${obj.replace(/\[|\]/g, '')}`);
        }
        return z.any();
    }
    return createZodSchema(jsonObject);
}

// Define input schema statically
const ExtractPropertyDataInputSchema = z.object({
  propertyTitlePdfDataUri: z
    .string()
    .describe(
      "A PDF file containing property title information, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  briefInformationPdfDataUri: z
    .string()
    .describe(
      "A PDF file containing brief property information, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractPropertyDataInput = z.infer<typeof ExtractPropertyDataInputSchema>;

// The output type will be dynamic based on the schema
export type ExtractPropertyDataOutput = z.infer<Awaited<ReturnType<typeof getOutputSchema>>>;

// Exported function to be used by the client
export async function extractPropertyData(input: ExtractPropertyDataInput): Promise<ExtractPropertyDataOutput> {
  const outputSchema = await getOutputSchema();
  const extractPropertyDataFlow = ai.defineFlow(
    {
      name: 'extractPropertyDataFlow',
      inputSchema: ExtractPropertyDataInputSchema,
      outputSchema: outputSchema,
    },
    async (flowInput) => {
        const jsonStructurePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
        const jsonFormat = await fs.readFile(jsonStructurePath, 'utf-8');

        const promptsPath = path.join(process.cwd(), 'src', 'lib', 'prompts.json');
        const promptsJson = await fs.readFile(promptsPath, 'utf-8');
        const prompts = JSON.parse(promptsJson);

        // TODO: Actually implement PDF extraction. For now, we are returning mock data based on the schema.
        // This is a placeholder for actual PDF text extraction logic.
        const propertyTitleText = "Mock extracted text from property title PDF.";
        const briefInformationText = "Mock extracted text from brief info PDF.";
        
        const finalPrompt = `${prompts.user_prompt}
---
**${prompts.extraction_hints_title}**
${prompts.extraction_hints}
---
**Output JSON Format:**
\`\`\`json
${jsonFormat}
\`\`\`
---
**PDF Document Content (Text Form):**

**File 1 (Property Title):**
{{{propertyTitleText}}}

**File 2 (Brief Information):**
{{{briefInformationText}}}
`;

        const prompt = ai.definePrompt({
            name: 'extractPropertyDataPrompt',
            system: prompts.system_prompt,
            input: {schema: z.object({
                propertyTitleText: z.string(),
                briefInformationText: z.string(),
            })},
            output: {schema: outputSchema},
            prompt: finalPrompt,
        });

        const { output } = await prompt({
            propertyTitleText,
            briefInformationText,
        });

        return output!;
    }
  );

  return extractPropertyDataFlow(input);
}
