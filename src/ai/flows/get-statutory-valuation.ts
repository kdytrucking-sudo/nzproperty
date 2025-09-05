
'use server';
/**
 * @fileOverview Extracts statutory valuation data from a given URL.
 * This flow is designed to be called manually by the user providing a specific URL.
 *
 * - getValuationFromUrl - A function that takes a URL and returns valuation data.
 * - GetValuationFromUrlInput - The input type for the function.
 * - GetValuationFromUrlOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GetValuationFromUrlInputSchema = z.object({
  url: z.string().url().describe('The URL of the property valuation page.'),
});
export type GetValuationFromUrlInput = z.infer<typeof GetValuationFromUrlInputSchema>;

const GetValuationFromUrlOutputSchema = z.object({
  landValueByWeb: z.string().describe('The Land Value extracted from the website.'),
  improvementsValueByWeb: z.string().describe('The Value of Improvements extracted from the website.'),
  ratingValueByWeb: z.string().describe('The Capital Value (Rating Valuation) extracted from the website.'),
});
export type GetValuationFromUrlOutput = z.infer<typeof GetValuationFromUrlOutputSchema>;

const prompt = ai.definePrompt({
    name: 'extractValuationFromUrlPrompt',
    input: { schema: z.object({ url: z.string() }) },
    output: { schema: GetValuationFromUrlOutputSchema },
    prompt: `Please extract the 'Land value', 'Value of improvements', and 'Capital value (rating valuation)' from the following URL. If a value cannot be found, return "N/A" for that field. URL: {{{url}}}`
});


export async function getValuationFromUrl(
  input: GetValuationFromUrlInput
): Promise<GetValuationFromUrlOutput> {
  return getValuationFromUrlFlow(input);
}

const getValuationFromUrlFlow = ai.defineFlow(
  {
    name: 'getValuationFromUrlFlow',
    inputSchema: GetValuationFromUrlInputSchema,
    outputSchema: GetValuationFromUrlOutputSchema,
  },
  async ({ url }) => {
    try {
      const { output } = await prompt({ url });
      
      if (!output) {
        throw new Error('AI could not extract valuation data from the provided URL.');
      }
      
      return GetValuationFromUrlOutputSchema.parse(output);

    } catch (error: any) {
        console.error("Error in getValuationFromUrlFlow:", error);
        if (error instanceof z.ZodError) {
             throw new Error(`AI returned data in an unexpected format. Details: ${error.errors.map(e => e.message).join(', ')}`);
        }
        throw new Error(error.message || 'An unknown error occurred while processing the URL.');
    }
  }
);
