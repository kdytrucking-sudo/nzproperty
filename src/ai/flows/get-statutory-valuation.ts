'use server';
/**
 * @fileOverview A Genkit flow to scrape statutory valuation data from a website.
 *
 * - getStatutoryValuation - A function that scrapes data for a given property address.
 * - GetStatutoryValuationInput - The input type for the function.
 * - GetStatutoryValuationOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  browse,
  goTo,
  findBy,
  click,
  type,
  extract,
} from '@genkit-ai/googleai';

const GetStatutoryValuationInputSchema = z.object({
  propertyAddress: z.string().describe('The property address to search for.'),
});
export type GetStatutoryValuationInput = z.infer<typeof GetStatutoryValuationInputSchema>;

const GetStatutoryValuationOutputSchema = z.object({
  landValueByWeb: z.string().describe('The Land Value from the website.'),
  improvementsValueByWeb: z.string().describe('The Value of Improvements from the website.'),
  ratingValueByWeb: z.string().describe('The Rating Valuation (Capital Value) from the website.'),
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
      const result = await browse(
        {
          headless: true, // Use true for production, false for debugging locally
        },
        async (page) => {
          await goTo(
            page,
            'https://new.aucklandcouncil.govt.nz/en/property-rates-valuations/find-property-rates-valuation.html'
          );

          // Wait for the address input field and type the address
          const addressInput = await findBy(page, {
            query: "[placeholder='Enter address']",
          });
          await type(addressInput, propertyAddress);

          // Find and click the search button
          const searchButton = await findBy(page, {
            query: "button[aria-label='Show property rates and valuation']",
          });
          await click(searchButton);

          // Wait for navigation/content to load after click.
          // A simple wait for a selector that appears on the results page is a good strategy.
          await page.waitForSelector(
            'h2:has-text("Latest valuation (2021)")',
            { timeout: 10000 } // 10 second timeout
          );

          // Extract the data
          const data = await extract(
            page,
            z.object({
              landValueByWeb: findBy({ query: "xpath=//dt[normalize-space(.)='Land value']/following-sibling::dd[1]" }),
              improvementsValueByWeb: findBy({ query: "xpath=//dt[normalize-space(.)='Value of improvements']/following-sibling::dd[1]" }),
              ratingValueByWeb: findBy({ query: "xpath=//dt[normalize-space(.)='Rating valuation (capital value)']/following-sibling::dd[1]" }),
            })
          );
          
          return data;
        }
      );

      if (!result.landValueByWeb && !result.improvementsValueByWeb && !result.ratingValueByWeb) {
        throw new Error('Could not find valuation details for the address provided. Please check the address and try again.');
      }

      return result;

    } catch (error: any) {
      console.error('Failed to scrape statutory valuation:', error);
      if (error.message.includes('timeout')) {
          throw new Error(`The website did not load the results in time. It's possible the address was not found. Please verify the address on the council website manually.`);
      }
      throw new Error(`Failed to retrieve data from web: ${error.message}`);
    }
  }
);
