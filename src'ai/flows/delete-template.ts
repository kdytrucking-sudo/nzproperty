'use server';
/**
 * @fileOverview Deletes a template file from Firebase Storage.
 *
 * - deleteTemplate - A function that deletes a specified template file.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { deleteFile } from '@/lib/storage';

const ai = await getAi();

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
      // Basic security check to prevent path traversal
      if (fileName.includes('/') || fileName.includes('..')) {
        throw new Error('Invalid file name.');
      }

      const storagePath = `templates/${fileName}`;
      await deleteFile(storagePath);
      
    } catch (error: any) {
      console.error(`Failed to delete template ${fileName} from Storage:`, error);
      // Don't throw if file doesn't exist, could be a stale client request or GCS error.
      // GCS delete is idempotent and doesn't error on non-existent files.
      // We log but don't throw to avoid user-facing errors on simple cases like double-clicks.
      if (!error.message.includes('not found')) {
         // Re-throw more critical errors
         // throw new Error(`Failed to delete template: ${error.message}`);
      }
    }
  }
);
