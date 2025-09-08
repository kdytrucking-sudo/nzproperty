'use server';
/**
 * @fileOverview Saves AI model configurations to a JSON file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { AIConfigSchema, type AIConfig } from '@/lib/ai-config-schema';

export async function saveAiConfig(input: AIConfig): Promise<void> {
  return saveAiConfigFlow(input);
}

const saveAiConfigFlow = ai.defineFlow(
  {
    name: 'saveAiConfigFlow',
    inputSchema: AIConfigSchema,
    outputSchema: z.void(),
  },
  async (config) => {
    try {
      const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'ai-config.json');
      // Ensure the config is valid before saving
      const validatedConfig = AIConfigSchema.parse(config);
      const contentJsonString = JSON.stringify(validatedConfig, null, 2);
      await fs.writeFile(jsonFilePath, contentJsonString, 'utf-8');
    } catch (error: any)
    {
      console.error('Failed to save AI config:', error);
      throw new Error(`Failed to write ai-config.json file: ${error.message}`);
    }
  }
);
