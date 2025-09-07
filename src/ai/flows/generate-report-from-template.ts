
'use server';
/**
 * DEPRECATED: This flow is no longer in use and will be removed in a future update.
 * The functionality has been replaced by generate-report-docx.ts using the 'docx' library.
 *
 * This file is kept temporarily to prevent breaking existing imports, but it should not be modified or used.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateReportInputSchema = z.object({
  templateFileName: z.string(),
  data: z.any(),
  imageDataUri: z.string().optional(),
});
export type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

const GenerateReportOutputSchema = z.object({
  generatedDocxDataUri: z.string(),
  replacementsCount: z.number(),
});
export type GenerateReportOutput = z.infer<typeof GenerateReportOutputSchema>;

export async function generateReportFromTemplate(
  input: GenerateReportInput
): Promise<GenerateReportOutput> {
   console.error("DEPRECATED: generateReportFromTemplate is called, but should be generateReportDocx.");
   throw new Error("This report generation method is deprecated. Please use the new 'docx' based generator.");
}
