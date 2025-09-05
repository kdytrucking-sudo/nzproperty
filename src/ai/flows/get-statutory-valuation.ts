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
import { browse, goTo, findBy, screenshot } from '@genkit-ai/googleai';

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
        const result = await browse(async () => {
            await goTo('https://www.aucklandcouncil.govt.nz/property-rates-valuations/pages/find-property-rates-valuation.aspx');
            await findBy(
                {
                    query: 'Enter a property address',
                    role: 'searchbox',
                },
                {
                    action: 'type',
                    args: [propertyAddress],
                }
            );
             await new Promise(resolve => setTimeout(resolve, 500)); // Wait for autocomplete
            await findBy(
                {
                    query: 'Show property rates and valuation',
                    role: 'button',
                },
                {
                    action: 'click',
                }
            );
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page to load

            const screenshotData = await screenshot();

            const { output } = await ai.generate({
                prompt: [
                    { media: { url: screenshotData } },
                    { text: `From the screenshot, extract the "Land Value", "Value of improvements", and "Capital value (rating valuation)". Return the extracted data as a JSON object with keys: landValueByWeb, improvementsValueByWeb, ratingValueByWeb.` }
                ],
                output: {
                    schema: GetStatutoryValuationOutputSchema,
                },
                model: 'googleai/gemini-2.5-flash-image-preview',
            });
            
            if (!output) {
                throw new Error('AI could not extract valuation data from the screenshot.');
            }
            return output;
        });

      if (!result) {
        throw new Error('AI could not extract valuation data. The website might not have information for this address or the page structure has changed.');
      }
      
      return GetStatutoryValuationOutputSchema.parse(result);

    } catch (error: any) {
        console.error("Error in getStatutoryValuationFlow:", error);
        if (error instanceof z.ZodError) {
             throw new Error(`AI returned data in an unexpected format. Details: ${error.errors.map(e => e.message).join(', ')}`);
        }
        throw new Error(`Failed to retrieve or process valuation data: ${error.message}`);
    }
  }
);
