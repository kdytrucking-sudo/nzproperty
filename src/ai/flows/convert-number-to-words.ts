'use server';
/**
 * @fileOverview A Genkit flow to convert a number into its English word representation.
 *
 * - convertNumberToWords - A function that handles the conversion.
 * - ConvertNumberToWordsInput - The input type for the function.
 * - ConvertNumberToWordsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ConvertNumberToWordsInputSchema = z.object({
  number: z.number().describe('The number to convert to words.'),
});
export type ConvertNumberToWordsInput = z.infer<typeof ConvertNumberToWordsInputSchema>;

const ConvertNumberToWordsOutputSchema = z.object({
  words: z.string().describe('The English word representation of the number, ending with "Dollars".'),
});
export type ConvertNumberToWordsOutput = z.infer<typeof ConvertNumberToWordsOutputSchema>;

export async function convertNumberToWords(input: ConvertNumberToWordsInput): Promise<ConvertNumberToWordsOutput> {
  return convertNumberToWordsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'convertNumberToWordsPrompt',
    input: { schema: ConvertNumberToWordsInputSchema },
    output: { schema: ConvertNumberToWordsOutputSchema },
    prompt: `Convert the following number to its English word representation, capitalized, and append " Dollars" at the end.

Input Number: {{{number}}}

Example:
Input: 940000
Output: Nine Hundred Forty Thousand Dollars

Input: 1250500
Output: One Million Two Hundred Fifty Thousand Five Hundred Dollars
`,
});


const convertNumberToWordsFlow = ai.defineFlow(
  {
    name: 'convertNumberToWordsFlow',
    inputSchema: ConvertNumberToWordsInputSchema,
    outputSchema: ConvertNumberToWordsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('AI failed to convert the number to words.');
    }
    return {
      words: output.words,
    };
  }
);
