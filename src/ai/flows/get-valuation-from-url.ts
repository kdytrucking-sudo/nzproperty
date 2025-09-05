'use server';
/**
 * @fileOverview Retrieves statutory valuation data from a given URL.
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
    prompt: `You are an expert data extractor. Please extract the valuation data from the content of the following URL.
The values are typically prefixed with labels like "Land value", "Value of improvements", and "Capital value (rating valuation)".
Return the data in the specified JSON format. If a value cannot be found in the page content, return "N/A" for that field.

URL to analyze: {{{url}}}`
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
      // Note: The 'gemini-pro' model with a prompt including a URL will automatically fetch and analyze the URL's content.
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
