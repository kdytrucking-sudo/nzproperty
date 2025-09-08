'use server';
/**
 * @fileOverview Retrieves AI model configurations from a JSON file.
 */

import fs from 'fs/promises';
import path from 'path';
import { AIConfigSchema, type AIConfig } from '@/lib/ai-config-schema';

export async function getAiConfig(): Promise<AIConfig> {
  const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'ai-config.json');
  try {
    const jsonString = await fs.readFile(jsonFilePath, 'utf-8');
    const data = JSON.parse(jsonString);
    // Use parse to validate and apply defaults
    return AIConfigSchema.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // If file doesn't exist, create it with default values
      const defaultConfig = AIConfigSchema.parse({});
      await fs.writeFile(jsonFilePath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      return defaultConfig;
    }
    console.error('Failed to get AI config:', error);
    // In case of other errors (e.g., parsing), return default config
    // to prevent app crash and log the error.
    return AIConfigSchema.parse({});
  }
}
