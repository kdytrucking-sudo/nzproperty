'use server';
/**
 * @fileOverview Saves the AI model configuration to a JSON file and "touches" genkit.ts to trigger a reload.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { AiConfigSchema, type AiConfig } from '@/lib/ai-config-schema';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'src', 'lib', 'ai-config.json');
const GENKIT_FILE_PATH = path.join(process.cwd(), 'src', 'ai', 'genkit.ts');

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
      // 1. Save the configuration to the JSON file.
      const configJsonString = JSON.stringify(config, null, 2);
      await fs.writeFile(CONFIG_FILE_PATH, configJsonString, 'utf-8');

      // 2. "Touch" the genkit.ts file to trigger a hot-reload in the development server.
      // This makes the server re-initialize Genkit with the new configuration.
      try {
        const content = await fs.readFile(GENKIT_FILE_PATH, 'utf-8');
        await fs.writeFile(GENKIT_FILE_PATH, content, 'utf-8');
      } catch (touchError) {
        console.warn(`Could not "touch" genkit.ts to reload AI config:`, touchError);
        // This is a non-critical error, so we just log a warning.
        // The config is saved, but a manual app restart might be needed.
      }

    } catch (error: any) {
      console.error('Failed to save AI configuration:', error);
      throw new Error(`Failed to write to ai-config.json: ${error.message}`);
    }
  }
);
