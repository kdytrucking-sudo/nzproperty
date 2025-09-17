'use server';
/**
 * @fileOverview Retrieves the current AI model configuration from a dedicated JSON file in Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { AiConfigSchema, type AiConfig, DEFAULT_AI_CONFIG } from '@/lib/ai-config-schema';
import { readJSON, writeJSON } from '@/lib/storage';

const CONFIG_STORAGE_PATH = 'json/ai-config.json';

export async function getAiConfig(): Promise<AiConfig> {
  return getAiConfigFlow();
}

const getAiConfigFlow = ai.defineFlow(
  {
    name: 'getAiConfigFlow',
    inputSchema: z.void(),
    outputSchema: AiConfigSchema,
  },
  async () => {
    try {
      const config = await readJSON(CONFIG_STORAGE_PATH);
      return AiConfigSchema.parse(config);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('No object exists')) {
        // File doesn't exist, create it with default values.
        try {
          await writeJSON(CONFIG_STORAGE_PATH, DEFAULT_AI_CONFIG);
          return DEFAULT_AI_CONFIG;
        } catch (writeError) {
           console.error('Failed to create default AI config file in Storage:', writeError);
           // If creation fails, return in-memory default to avoid crashing.
           return DEFAULT_AI_CONFIG;
        }
      }
      console.error('Failed to read or parse AI config file from Storage:', error);
      // On any other error, return the default config as a fallback.
      return DEFAULT_AI_CONFIG;
    }
  }
);
