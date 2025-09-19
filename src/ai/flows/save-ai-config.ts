'use server';
/**
 * @fileOverview Saves the AI model configuration to a JSON file in Firebase Storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { AiConfigSchema, type AiConfig } from '@/lib/ai-config-schema';
import { writeJSON } from '@/lib/storage';

const ai = await getAi();

const CONFIG_STORAGE_PATH = 'json/ai-config.json';


export async function saveAiConfig(input: AiConfig): Promise<void> {
  return saveAiConfigFlow(input);
}

const saveAiConfigFlow = ai.defineFlow(
  {
    name: 'saveAiConfigFlow',
    inputSchema: AiConfigSchema,
    outputSchema: z.void(),
  },
  async (config) => {
    try {
      // Save the configuration to the JSON file in Firebase Storage.
      await writeJSON(CONFIG_STORAGE_PATH, config);
    } catch (error: any) {
      console.error('Failed to save AI configuration to Storage:', error);
      throw new Error(`Failed to write to ai-config.json in Firebase Storage: ${error.message}`);
    }
  }
);
