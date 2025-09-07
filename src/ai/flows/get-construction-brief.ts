'use server';
/**
 * @fileOverview Retrieves the construction brief from a JSON file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

const ConstructionBriefSchema = z.object({
  brief: z.string(),
});

type ConstructionBriefData = z.infer<typeof ConstructionBriefSchema>;

export async function getConstructionBrief(): Promise<ConstructionBriefData> {
  return getConstructionBriefFlow();
}

const getConstructionBriefFlow = ai.defineFlow(
  {
    name: 'getConstructionBriefFlow',
    inputSchema: z.void(),
    outputSchema: ConstructionBriefSchema,
  },
  async () => {
    const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'construction-brief.json');
    try {
      const jsonString = await fs.readFile(jsonFilePath, 'utf-8');
      const data = JSON.parse(jsonString);
      return ConstructionBriefSchema.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // If the file doesn't exist, return a default structure.
        const defaultData: ConstructionBriefData = {
            brief: ''
        };
        // We don't write the file here, just return the default. It will be created on first save.
        return defaultData;
      }
      console.error('Failed to get construction brief:', error);
      throw new Error(`Failed to read or parse construction brief file: ${error.message}`);
    }
  }
);
