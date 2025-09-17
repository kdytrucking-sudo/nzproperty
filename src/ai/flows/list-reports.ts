'use server';
/**
 * @fileOverview Lists generated report files from Firebase Storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { listFileNames, getFileURL } from '@/lib/storage';

const ai = await getAi();

const ReportFileSchema = z.object({
  name: z.string(),
  timeCreated: z.string(),
  downloadUrl: z.string().url(),
});

const ListReportsOutputSchema = z.array(ReportFileSchema);

export type ReportFile = z.infer<typeof ReportFileSchema>;

export async function listReports(): Promise<ReportFile[]> {
  return listReportsFlow();
}

const listReportsFlow = ai.defineFlow(
  {
    name: 'listReportsFlow',
    inputSchema: z.void(),
    outputSchema: ListReportsOutputSchema,
  },
  async () => {
    try {
      const reportNames = await listFileNames('reports');
      
      const reports = await Promise.all(
        reportNames.map(async (name) => {
          // Heuristic to extract a date from the filename, e.g., "... - YYYY-MM-DD.docx"
          const match = name.match(/(\d{4}-\d{2}-\d{2})/);
          const timeCreated = match ? new Date(match[0]).toISOString() : new Date(0).toISOString(); // Fallback date

          const downloadUrl = await getFileURL(`reports/${name}`);
          
          return {
            name,
            timeCreated,
            downloadUrl,
          };
        })
      );
      
      // Sort by creation time, descending
      reports.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime());

      return reports;
    } catch (error) {
      console.error('Failed to list reports from Firebase Storage:', error);
      // Return an empty array on error to prevent crashing the client
      return [];
    }
  }
);