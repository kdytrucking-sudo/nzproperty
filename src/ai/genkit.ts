'use server';

import {genkit, type ModelArgument} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {getAiConfig} from './flows/get-ai-config';
import type {AIConfig} from '@/lib/ai-config-schema';

// We wrap the genkit initialization in a function to dynamically
// load the configuration from a file. This allows the model and
// its parameters to be configured from the UI.

let aiInstance: ModelArgument<any> | null = null;
let aiConfig: AIConfig | null = null;

async function getAiInstance() {
  if (!aiInstance) {
    aiConfig = await getAiConfig();
    aiInstance = genkit({
      plugins: [googleAI()],
      model: aiConfig.model,
    });
  }
  return aiInstance;
}

export async function getModelConfig() {
  if (!aiConfig) {
    aiConfig = await getAiConfig();
  }
  return {
    temperature: aiConfig.temperature,
    topP: aiConfig.topP,
    topK: aiConfig.topK,
    maxOutputTokens: aiConfig.maxOutputTokens,
  };
}

// Re-exporting ai functions wrapping them in a dynamic initializer
async function getInitializedAi() {
  return getAiInstance();
}

async function defineFlow(options: any, fn: any) {
  const ai = await getInitializedAi();
  return ai.defineFlow(options, fn);
}

async function definePrompt(options: any) {
  const ai = await getInitializedAi();
  return ai.definePrompt(options);
}

async function generate(options: any) {
    const ai = await getInitializedAi();
    return ai.generate(options);
}


export const ai = {
    defineFlow,
    definePrompt,
    generate,
};


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
