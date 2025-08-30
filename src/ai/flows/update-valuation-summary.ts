'use server';

/**
 * @fileOverview This file defines a Genkit flow for updating the valuation summary of a property.
 *
 * - `updateValuationSummary` - A function that updates the valuation summary of a property.
 * - `UpdateValuationSummaryInput` - The input type for the `updateValuationSummary` function.
 * - `UpdateValuationSummaryOutput` - The return type for the `updateValuationSummary` function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const UpdateValuationSummaryInputSchema = z.object({
  valuationDate: z.string().describe('The date of the valuation.'),
  marketValue: z.string().describe('The market value of the property.'),
  methodologyUsed: z.string().describe('The methodology used for the valuation.'),
  keyAssumptions: z.string().describe('The key assumptions made during the valuation.'),
  currentValuationSummary: z.string().describe('The current valuation summary.'),
});

export type UpdateValuationSummaryInput = z.infer<typeof UpdateValuationSummaryInputSchema>;

const UpdateValuationSummaryOutputSchema = z.object({
  updatedValuationSummary: z.string().describe('The updated valuation summary.'),
});

export type UpdateValuationSummaryOutput = z.infer<typeof UpdateValuationSummaryOutputSchema>;

export async function updateValuationSummary(
  input: UpdateValuationSummaryInput
): Promise<UpdateValuationSummaryOutput> {
  return updateValuationSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'updateValuationSummaryPrompt',
  input: {schema: UpdateValuationSummaryInputSchema},
  output: {schema: UpdateValuationSummaryOutputSchema},
  prompt: `You are an expert property valuer. You will rewrite the valuation summary based on the updated information provided by the user to make sure it sounds professional and is free of errors.

Here is the current valuation summary: {{{currentValuationSummary}}}

Here is the updated information:
Valuation Date: {{{valuationDate}}}
Market Value: {{{marketValue}}}
Methodology Used: {{{methodologyUsed}}}
Key Assumptions: {{{keyAssumptions}}}`,
});

const updateValuationSummaryFlow = ai.defineFlow(
  {
    name: 'updateValuationSummaryFlow',
    inputSchema: UpdateValuationSummaryInputSchema,
    outputSchema: UpdateValuationSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return {
      updatedValuationSummary: output!.updatedValuationSummary,
    };
  }
);
