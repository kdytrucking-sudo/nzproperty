'use server';
/**
 * @fileOverview Deletes a generated report file from Firebase Storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { deleteFile } from '@/lib/storage';

const ai = await getAi();

const DeleteReportInputSchema = z.object({
  fileName: z.string().describe('The name of the report file to delete.'),
});

export async function deleteReport(input: { fileName: string }): Promise<void> {
  return deleteReportFlow(input);
}

const deleteReportFlow = ai.defineFlow(
  {
    name: 'deleteReportFlow',
    inputSchema: DeleteReportInputSchema,
    outputSchema: z.void(),
  },
  async ({ fileName }) => {
    // Basic security check to prevent path traversal
    if (fileName.includes('/') || fileName.includes('..')) {
      throw new Error('Invalid file name.');
    }
    const storagePath = `reports/${fileName}`;
    await deleteFile(storagePath);
  }
);