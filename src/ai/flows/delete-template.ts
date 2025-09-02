'use server';
/**
 * @fileOverview Deletes a template file from the server.
 *
 * - deleteTemplate - A function that deletes a specified template file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

const DeleteTemplateInputSchema = z.object({
  fileName: z.string().describe('The name of the template file to delete.'),
});

export type DeleteTemplateInput = z.infer<typeof DeleteTemplateInputSchema>;

export async function deleteTemplate(input: DeleteTemplateInput): Promise<void> {
  return deleteTemplateFlow(input);
}

const deleteTemplateFlow = ai.defineFlow(
  {
    name: 'deleteTemplateFlow',
    inputSchema: DeleteTemplateInputSchema,
    outputSchema: z.void(),
  },
  async ({ fileName }) => {
    try {
      const templatesDir = path.join(process.cwd(), 'src', 'lib', 'templates');
      // Basic security check to prevent path traversal
      if (fileName.includes('..') || fileName.includes('/')) {
        throw new Error('Invalid file name.');
      }
      const filePath = path.join(templatesDir, fileName);
      await fs.unlink(filePath);
    } catch (error: any) {
      console.error(`Failed to delete template ${fileName}:`, error);
      // Don't throw if file doesn't exist, could be a stale client request
      if (error.code !== 'ENOENT') {
         throw new Error(`Failed to delete template: ${error.message}`);
      }
    }
  }
);
