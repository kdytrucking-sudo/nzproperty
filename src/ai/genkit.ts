'use server';

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {getAiConfig} from './flows/get-ai-config';
import type {AIConfig} from '@/lib/ai-config-schema';

// Initialize Genkit synchronously. This is crucial for stability.
// The model configuration will be applied dynamically at runtime.
export const ai = genkit({
  plugins: [googleAI()],
});

/**
 * Retrieves the dynamic AI model configuration at runtime.
 * This function will be called just before executing a prompt.
 */
export async function getModelConfig(): Promise<Partial<AIConfig> & { model: string }> {
  try {
    const config = await getAiConfig();
    return {
      model: config.model,
      temperature: config.temperature,
      topP: config.topP,
      topK: config.topK,
      maxOutputTokens: config.maxOutputTokens,
    };
  } catch (error) {
    console.error("Failed to get AI config, using defaults.", error);
    // Return a default configuration if the file read fails
    return {
        model: 'googleai/gemini-1.5-pro',
        temperature: 0.5,
        topP: 1,
        topK: 32,
        maxOutputTokens: 8192,
    };
  }
}
