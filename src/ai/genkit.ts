'use server';

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
  /**
   * The configuration for the model.
   *
   * @see https://genkit.dev/docs/flow-config#model-configuration
   *
   * @example
   * ```ts
   * export const ai = genkit({
   *   plugins: [googleAI()],
   *   model: 'googleai/gemini-1.5-flash',
   *   config: {
   *     temperature: 0.5,
   *     maxOutputTokens: 2048,
   *     topK: 40,
   *     topP: 0.95,
   *     stopSequences: ['\n'],
   *     safetySettings: [
   *      {
   *        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
   *        threshold: 'BLOCK_ONLY_HIGH',
   *      },
   *    ],
   *   },
   * });
   * ```
   */
});
