'use server';
/**
 * @fileOverview Lists available .docx templates from Firebase Storage.
 *
 * - listTemplates - A function that returns an array of template file information.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { listFileNames, getFileURL } from '@/lib/storage';

const ai = await getAi();

const TemplateFileSchema = z.object({
  name: z.string(),
  downloadUrl: z.string().url(),
});

const ListTemplatesOutputSchema = z.array(TemplateFileSchema);

export type TemplateFile = z.infer<typeof TemplateFileSchema>;

export async function listTemplates(): Promise<TemplateFile[]> {
  return listTemplatesFlow();
}

const listTemplatesFlow = ai.defineFlow(
  {
    name: 'listTemplatesFlow',
    inputSchema: z.void(),
    outputSchema: ListTemplatesOutputSchema,
  },
  async () => {
    try {
      const docxFileNames = await listFileNames('templates');
      const filteredNames = docxFileNames.filter(file => file.endsWith('.docx'));

      const templates = await Promise.all(
        filteredNames.map(async (name) => {
          const downloadUrl = await getFileURL(`templates/${name}`);
          return { name, downloadUrl };
        })
      );
      
      return templates;
    } catch (error) {
      console.error('Failed to list templates from Firebase Storage:', error);
      return [];
    }
  }
);
