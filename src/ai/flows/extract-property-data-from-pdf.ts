'use server';
/**
 * @fileOverview Extracts property data from uploaded PDFs using Gemini API.
 *
 * - extractPropertyData - A function that handles the extraction of property data from PDFs.
 * - ExtractPropertyDataInput - The input type for the extractPropertydata function.
 * - ExtractPropertyDataOutput - The return type for the extractPropertyData function.
 */

import { ai, getModelConfig } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

// Dynamically create the Zod schema from the JSON file
async function getOutputSchema() {
    const filePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
    const jsonString = await fs.readFile(filePath, 'utf-8');
    const jsonObject = JSON.parse(jsonString);

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


let extractPropertyDataFlow: ((input: ExtractPropertyDataInput) => Promise<ExtractPropertyDataOutput>) | null = null;
let isInitializing = false;

// This function initializes the flow just once.
async function initializeFlow() {
    if (extractPropertyDataFlow || isInitializing) {
        return;
    }
    isInitializing = true;

    try {
        const outputSchema = await getOutputSchema();
        const jsonStructurePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
        const jsonFormat = await fs.readFile(jsonStructurePath, 'utf-8');
        const promptsPath = path.join(process.cwd(), 'src', 'lib', 'prompts.json');
        const promptsJson = await fs.readFile(promptsPath, 'utf-8');
        const prompts = JSON.parse(promptsJson);

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
        
        // Define the prompt structure statically. The model and config are applied at runtime.
        const prompt = ai.definePrompt({
            name: 'extractPropertyDataPrompt',
            system: prompts.system_prompt,
            input: {schema: ExtractPropertyDataInputSchema },
            output: {schema: outputSchema},
            prompt: finalPrompt,
        });

        // Define the flow structure statically.
        extractPropertyDataFlow = ai.defineFlow(
          {
            name: 'extractPropertyDataFlow',
            inputSchema: ExtractPropertyDataInputSchema,
            outputSchema: outputSchema,
          },
          async (flowInput) => {
            // Get the latest model configuration at the time of execution.
            const modelConfig = await getModelConfig();
            
            const { output } = await prompt(flowInput, {
                model: modelConfig.model,
                config: {
                    temperature: modelConfig.temperature,
                    topP: modelConfig.topP,
                    topK: modelConfig.topK,
                    maxOutputTokens: modelConfig.maxOutputTokens,
                },
            });

            if (!output) {
              throw new Error('AI failed to extract data. The output was empty.');
            }

            return output;
          }
        );
    } finally {
        isInitializing = false;
    }
}

// Exported function to be used by the client
export async function extractPropertyData(input: ExtractPropertyDataInput): Promise<ExtractPropertyDataOutput> {
  // Ensure the flow is initialized before running it.
  if (!extractPropertyDataFlow) {
      await initializeFlow();
  }

  if (!extractPropertyDataFlow) {
      throw new Error("Flow could not be initialized.");
  }
  
  return extractPropertyDataFlow(input);
}
