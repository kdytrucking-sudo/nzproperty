'use server';
/**
 * @fileOverview Retrieves the current AI model configuration from a dedicated JSON file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { AiConfigSchema, type AiConfig, DEFAULT_AI_CONFIG } from '@/lib/ai-config-schema';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'src', 'lib', 'ai-config.json');

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
      const jsonString = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
      const config = JSON.parse(jsonString);
      return AiConfigSchema.parse(config);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create it with default values.
        try {
          await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(DEFAULT_AI_CONFIG, null, 2), 'utf-8');
          return DEFAULT_AI_CONFIG;
        } catch (writeError) {
           console.error('Failed to create default AI config file:', writeError);
           // If creation fails, return in-memory default to avoid crashing.
           return DEFAULT_AI_CONFIG;
        }
      }
      console.error('Failed to read or parse AI config file:', error);
      // On any other error, return the default config as a fallback.
      return DEFAULT_AI_CONFIG;
    }
  }
);
