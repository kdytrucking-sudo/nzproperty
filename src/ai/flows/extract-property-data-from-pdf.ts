'use server';
/**
 * @fileOverview Extracts property data from uploaded PDFs using Gemini API.
 *
 * - extractPropertyData - A function that handles the extraction of property data from PDFs.
 * - ExtractPropertyDataInput - The input type for the extractPropertyData function.
 * - ExtractPropertyDataOutput - The return type for the extractPropertyData function.
 */

import {getAi} from '@/ai/genkit';
import {z} from 'genkit';
import { readJSON } from '@/lib/storage';

const ai = await getAi();

// Dynamically create the Zod schema from the JSON file content from storage
async function getOutputSchema() {
    const jsonObject = await readJSON('json/json-structure.json');

    function createZodSchema(obj: any): z.ZodType<any> {
        if (Array.isArray(obj)) {
            return obj.length > 0 ? z.array(createZodSchema(obj[0])) : z.array(z.any());
        } else if (typeof obj === 'object' && obj !== null) {
            const shape: { [key: string]: z.ZodType<any> } = {};
            for (const key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null && 'placeholder' in obj[key]) {
                    const fieldConfig = obj[key];
                    const description = `Extracted data for ${fieldConfig.label || key}`;
                    
                    let zodType;
                    if (fieldConfig.validation?.type === 'number') {
                        zodType = z.union([z.number(), z.string()]).describe(description);
                    } else {
                        zodType = z.string().describe(description);
                    }
                    
                    shape[key] = zodType;

                } else {
                    shape[key] = createZodSchema(obj[key]);
                }
            }
            return z.object(shape);
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
        const [jsonStructureObj, prompts] = await Promise.all([
          readJSON('json/json-structure.json'),
          readJSON('json/prompts.json'),
        ]);
        const jsonFormat = JSON.stringify(jsonStructureObj, null, 2);

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
**Documents to Analyze:**

**Document 1 (Property Title):**
{{media url=propertyTitlePdfDataUri}}

**Document 2 (Brief Information):**
{{media url=briefInformationPdfDataUri}}
`;

        const prompt = ai.definePrompt({
            name: 'extractPropertyDataPrompt',
            system: prompts.system_prompt,
            input: {schema: ExtractPropertyDataInputSchema },
            output: {schema: outputSchema},
            prompt: finalPrompt,
        });

        const { output } = await prompt(flowInput);

        if (!output) {
          throw new Error('AI failed to extract data. The output was empty.');
        }

        return output;
    }
  );

  return extractPropertyDataFlow(input);
}
