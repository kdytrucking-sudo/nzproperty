'use server';
/**
 * @fileOverview Saves the provided AI model configuration to genkit.ts.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { AiConfigSchema, type AiConfig } from '@/lib/ai-config-schema';

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
      const genkitFilePath = path.join(process.cwd(), 'src', 'ai', 'genkit.ts');
      
      const configParts = [];
      if (config.temperature !== undefined) configParts.push(`    temperature: ${config.temperature},`);
      if (config.topP !== undefined) configParts.push(`    topP: ${config.topP},`);
      if (config.topK !== undefined) configParts.push(`    topK: ${config.topK},`);
      if (config.maxOutputTokens !== undefined) configParts.push(`    maxOutputTokens: ${config.maxOutputTokens},`);

      const configString = configParts.length > 0 
        ? `
  config: {
${configParts.join('\n')}
  },`
        : '';
        
      const newContent = `// GENKIT_CONFIG_START
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  model: '${config.model}',${configString}
});
// GENKIT_CONFIG_END
`;

      await fs.writeFile(genkitFilePath, newContent, 'utf-8');

    } catch (error: any) {
      console.error('Failed to save AI configuration:', error);
      throw new Error(`Failed to write genkit.ts file: ${error.message}`);
    }
  }
);
