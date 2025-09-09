'use server';
/**
 * @fileOverview Retrieves the current AI model configuration from genkit.ts.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { AiConfigSchema, type AiConfig, DEFAULT_AI_CONFIG } from '@/lib/ai-config-schema';

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
      const genkitFilePath = path.join(process.cwd(), 'src', 'ai', 'genkit.ts');
      const content = await fs.readFile(genkitFilePath, 'utf-8');

      const modelMatch = content.match(/model:\s*['"](.*?)['"]/);
      const tempMatch = content.match(/temperature:\s*([0-9.]+)/);
      const topPMatch = content.match(/topP:\s*([0-9.]+)/);
      const topKMatch = content.match(/topK:\s*([0-9]+)/);
      const maxTokensMatch = content.match(/maxOutputTokens:\s*([0-9]+)/);

      const config: AiConfig = {
        model: modelMatch ? modelMatch[1] : DEFAULT_AI_CONFIG.model,
        temperature: tempMatch ? parseFloat(tempMatch[1]) : DEFAULT_AI_CONFIG.temperature,
        topP: topPMatch ? parseFloat(topPMatch[1]) : DEFAULT_AI_CONFIG.topP,
        topK: topKMatch ? parseInt(topKMatch[1], 10) : DEFAULT_AI_CONFIG.topK,
        maxOutputTokens: maxTokensMatch ? parseInt(maxTokensMatch[1], 10) : DEFAULT_AI_CONFIG.maxOutputTokens,
      };
      
      return AiConfigSchema.parse(config);

    } catch (error: any) {
      console.error('Failed to get AI config:', error);
      // Return default config if file is missing or parsing fails
      return DEFAULT_AI_CONFIG;
    }
  }
);
