'use server';
/**
 * @fileOverview Retrieves statutory valuation data from a given URL.
 *
 * - getStatutoryValuation - A function that takes a URL and returns valuation data.
 * - GetStatutoryValuationInput - The input type for the function.
 * - GetStatutoryValuationOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GetStatutoryValuationInputSchema = z.object({
  url: z.string().url().describe('The URL of the property valuation page.'),
});
export type GetStatutoryValuationInput = z.infer<typeof GetStatutoryValuationInputSchema>;

const GetStatutoryValuationOutputSchema = z.object({
  landValueByWeb: z.string().describe('The Land Value extracted from the website.'),
  improvementsValueByWeb: z.string().describe('The Value of Improvements extracted from the website.'),
  ratingValueByWeb: z.string().describe('The Capital Value (Rating Valuation) extracted from the website.'),
});
export type GetStatutoryValuationOutput = z.infer<typeof GetStatutoryValuationOutputSchema>;

const prompt = ai.definePrompt({
    name: 'extractValuationFromUrlPrompt',
    input: { schema: z.object({ url: z.string() }) },
    output: { schema: GetStatutoryValuationOutputSchema },
    prompt: `Please extract the 'Land value', 'Value of improvements', and 'Capital value (rating valuation)' from the following URL. If a value cannot be found, return "N/A" for that field. URL: {{{url}}}`
});


export async function getStatutoryValuation(
  input: GetStatutoryValuationInput
): Promise<GetStatutoryValuationOutput> {
  return getStatutoryValuationFlow(input);
}

const getStatutoryValuationFlow = ai.defineFlow(
  {
    name: 'getStatutoryValuationFlow',
    inputSchema: GetStatutoryValuationInputSchema,
    outputSchema: GetStatutoryValuationOutputSchema,
  },
  async ({ url }) => {
    try {
      const { output } = await prompt({ url });
      
      if (!output) {
        throw new Error('AI could not extract valuation data from the provided URL.');
      }
      
      return GetStatutoryValuationOutputSchema.parse(output);

    } catch (error: any) {
        console.error("Error in getStatutoryValuationFlow:", error);
        if (error instanceof z.ZodError) {
             throw new Error(`AI returned data in an unexpected format. Details: ${error.errors.map(e => e.message).join(', ')}`);
        }
        throw new Error(error.message || 'An unknown error occurred while processing the URL.');
    }
  }
);
