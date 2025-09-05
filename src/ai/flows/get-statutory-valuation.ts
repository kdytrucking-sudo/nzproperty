'use server';
/**
 * @fileOverview Retrieves statutory valuation data from the Auckland Council website using a Google Search Tool.
 *
 * - getStatutoryValuation - A function that takes a property address and returns valuation data.
 * - GetStatutoryValuationInput - The input type for the function.
 * - GetStatutoryValuationOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import axios from 'axios';

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


const getWebValuation = ai.defineTool(
    {
      name: 'getWebValuation',
      description: 'Searches the Auckland Council website for a property\'s statutory valuation data using a property address. Returns the most relevant text snippets.',
      inputSchema: GetStatutoryValuationInputSchema,
      outputSchema: z.object({
        snippets: z.array(z.string()).describe('Relevant text snippets from the search results.'),
        error: z.string().optional().describe('An error message if the search failed.'),
      }),
    },
    async ({ propertyAddress }) => {
      const apiKey = process.env.GOOGLE_API_KEY;
      const searchEngineId = process.env.SEARCH_ENGINE_ID;
  
      if (!apiKey || !searchEngineId) {
        return { snippets: [], error: 'Google API Key or Search Engine ID is not configured.' };
      }
  
      const url = `https://www.googleapis.com/customsearch/v1`;
      const params = {
        key: apiKey,
        cx: searchEngineId,
        q: `${propertyAddress} valuation`,
        siteSearch: '*.aucklandcouncil.govt.nz'
      };
  
      try {
        const response = await axios.get(url, { params });
        const items = response.data.items || [];
        if (items.length === 0) {
            return { snippets: [], error: `No results found for the address "${propertyAddress}".` };
        }
        const snippets = items.map((item: any) => item.snippet || item.title).slice(0, 5); // Get top 5 snippets
        return { snippets };
      } catch (error: any) {
        console.error('Google Custom Search API error:', error.response?.data || error.message);
        const errorMessage = error.response?.data?.error?.message || 'Failed to perform web search.';
        return { snippets: [], error: errorMessage };
      }
    }
);

const valuationPrompt = ai.definePrompt({
    name: 'extractValuationFromSnippets',
    system: 'You are an expert data extractor. Analyze the provided text snippets from a website search and extract the required valuation figures. The values are typically prefixed with labels like "Land value", "Value of improvements", and "Capital value (rating valuation)". Return the data in the specified JSON format. If a value cannot be found in the snippets, or if the snippets array is empty, return "N/A" for that field.',
    input: { schema: z.object({ propertyAddress: z.string(), snippets: z.array(z.string()) }) },
    output: { schema: GetStatutoryValuationOutputSchema },
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
  async ({ propertyAddress }) => {
    try {
      // Step 1: Call the tool to get website snippets
      const searchResult = await getWebValuation({ propertyAddress });

      // Step 2: Handle potential errors from the tool
      if (searchResult.error) {
        throw new Error(`Web search failed: ${searchResult.error}`);
      }

      // Step 3: Call the AI prompt with the retrieved snippets
      const { output } = await valuationPrompt({ propertyAddress, snippets: searchResult.snippets });

      if (!output) {
        throw new Error('AI could not extract valuation data from the search results.');
      }
      
      return GetStatutoryValuationOutputSchema.parse(output);

    } catch (error: any) {
        console.error("Error in getStatutoryValuationFlow:", error);
        if (error instanceof z.ZodError) {
             throw new Error(`AI returned data in an unexpected format. Details: ${error.errors.map(e => e.message).join(', ')}`);
        }
        // Re-throw the original error, which will be more descriptive now
        throw new Error(error.message || 'An unknown error occurred while processing valuation data.');
    }
  }
);
