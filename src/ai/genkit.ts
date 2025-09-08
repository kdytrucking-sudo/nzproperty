import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});

/*
 * ----------------------------------------------------------------
 * AI Model Configuration Parameters
 * ----------------------------------------------------------------
 *
 * When calling the AI model using `ai.generate()` or `ai.definePrompt()`,
 * you can pass a `config` object to customize the model's behavior.
 *
 * Example usage in a flow:
 *
 * const { output } = await prompt(
 *   {...}, // your input
 *   {
 *     config: {
 *       temperature: 0.7,
 *       maxOutputTokens: 2048,
 *     }
 *   }
 * );
 *
 *
 * Here are the common parameters available in the `config` object:
 *
 * 1. `temperature`:
 *    - Controls the randomness of the output.
 *    - A higher value (e.g., 1.0) makes the output more creative and diverse.
 *    - A lower value (e.g., 0.2) makes the output more deterministic and focused.
 *    - Range: 0.0 to 1.0
 *
 * 2. `maxOutputTokens`:
 *    - The maximum number of tokens (words/sub-words) the model can generate in a single response.
 *    - Type: integer
 *
 * 3. `topK`:
 *    - Influences the sampling strategy. The model considers the top K most probable tokens for the next word.
 *    - Helps prevent the model from generating unlikely or nonsensical words.
 *    - Type: integer
 *
 * 4. `topP`:
 *    - An alternative sampling strategy based on cumulative probability. The model selects from the most probable
 *      tokens whose cumulative probability exceeds the `topP` value.
 *    - Range: 0.0 to 1.0
 *
 * 5. `stopSequences`:
 *    - An array of strings. The model will stop generating text as soon as it encounters one of these sequences.
 *    - Example: `['\n', '###']`
 *
 * 6. `safetySettings`:
 *    - Allows you to adjust the thresholds for the built-in safety filters.
 *    - You can set different blocking levels for various harm categories.
 *    - Example:
 *      [
 *        {
 *          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
 *          threshold: 'BLOCK_ONLY_HIGH', // or 'BLOCK_NONE', 'BLOCK_MEDIUM_AND_ABOVE', etc.
 *        }
 *      ]
 */
