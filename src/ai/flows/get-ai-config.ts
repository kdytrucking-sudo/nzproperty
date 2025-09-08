'use server';
/**
 * @fileOverview Retrieves AI model configurations from a JSON file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { AIConfigSchema, type AIConfig } from '@/lib/ai-config-schema';

export async function getAiConfig(): Promise<AIConfig> {
  return getAiConfigFlow();
}

const getAiConfigFlow = ai.defineFlow(
  {
    name: 'getAiConfigFlow',
    inputSchema: z.void(),
    outputSchema: AIConfigSchema,
  },
  async () => {
    const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'ai-config.json');
    try {
      const jsonString = await fs.readFile(jsonFilePath, 'utf-8');
      const data = JSON.parse(jsonString);
      return AIConfigSchema.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        const defaultConfig = AIConfigSchema.parse({});
        await fs.writeFile(jsonFilePath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
        return defaultConfig;
      }
      console.error('Failed to get AI config:', error);
      throw new Error(`Failed to read or parse ai-config.json file: ${error.message}`);
    }
  }
);
