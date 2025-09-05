'use server';
/**
 * @fileOverview Retrieves statutory valuation data from the Auckland Council website.
 *
 * - getStatutoryValuation - A function that takes a property address and returns valuation data.
 * - GetStatutoryValuationInput - The input type for the function.
 * - GetStatutoryValuationOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { browse } from '@genkit-ai/googleai';

const GetStatutoryValuationInputSchema = z.object({
  propertyAddress: z.string().describe('The property address to search for.'),
});
export type GetStatutoryValuationInput = z.infer<typeof GetStatutoryValuationInputSchema>;

const GetStatutoryValuationOutputSchema = z.object({
  landValueByWeb: z.string().describe('The Land Value extracted from the website.'),
  improvementsValueByWeb: z.string().describe('The Value of Improvements extracted from the website.'),
  ratingValueByWeb: z.string().describe('The Capital Value (Rating Valuation) extracted from the website.'),
});
export type GetStatutoryValuationOutput = z.infer<typeof GetStatutoryValuationOutputSchema>;

// This is the exported wrapper function that the client will call.
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
  async ({ propertyAddress }) => {
    try {
      const browseResult = await browse({
        url: 'https://www.aucklandcouncil.govt.nz/property-rates-valuations/find-property-rates-valuation',
        args: {
            query: propertyAddress,
            task: `Extract the "Land Value", "Value of Improvements", and "Capital Value (Rating Valuation)" for the address: ${propertyAddress}.`,
            output: {
                landValueByWeb: "Extracted Land Value",
                improvementsValueByWeb: "Extracted Value of Improvements",
                ratingValueByWeb: "Extracted Capital Value (Rating Valuation)"
            }
        },
      });

      const { output } = browseResult;

      if (!output) {
        throw new Error('AI could not extract valuation data. The website might not have information for this address or the page structure has changed.');
      }
      
      // Ensure the output matches the expected schema. Zod will throw if it doesn't.
      return GetStatutoryValuationOutputSchema.parse(output);

    } catch (error: any) {
        console.error("Error in getStatutoryValuationFlow:", error);
        if (error instanceof z.ZodError) {
             throw new Error(`AI returned data in an unexpected format. Details: ${error.errors.map(e => e.message).join(', ')}`);
        }
        throw new Error(`Failed to retrieve or process valuation data: ${error.message}`);
    }
  }
);
