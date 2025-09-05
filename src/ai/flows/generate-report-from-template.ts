
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a report from a Word template.
 *
 * - `generateReportFromTemplate` - A function that fills a .docx template with provided data.
 * - `GenerateReportInput` - The input type for the `generateReportFrom-template` function.
 * - `GenerateReportOutput` - The return type for the `generateReportFromTemplate` function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs/promises';
import path from 'path';
import initialJsonStructure from '@/lib/json-structure.json';
import globalContent from '@/lib/global-content.json';
import { contentFields } from '@/lib/content-config';


const normalizeNewlines = (s: any) =>
  s ? s.toString().replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n') : '';

const convertSoftBreaksToHardParagraphs = (zip: any) => {
  const targets = Object.keys(zip.files).filter((name) =>
    /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(name)
  );

  const PARAGRAPH_BLOCK = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  const SOFT_BREAK = /<w:br\b[^\/]*\/>/g;

  targets.forEach((name) => {
    const file = zip.file(name);
    if (!file) return;

    let xml = file.asText();
    
    let hasReplaced = false;

    xml = xml.replace(PARAGRAPH_BLOCK, (pBlock) => {
       if (SOFT_BREAK.test(pBlock)) {
           hasReplaced = true;
           return pBlock.replace(SOFT_BREAK, '</w:t></w:r></w:p><w:p><w:r><w:t>');
       }
       return pBlock;
    });

    if (hasReplaced) {
        zip.file(name, xml);
    }
  });
};


const GenerateReportInputSchema = z.object({
  templateFileName: z.string().describe('The file name of the .docx template stored on the server.'),
  data: z.any().describe('The JSON data to populate the template with.'),
});
export type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

const GenerateReportOutputSchema = z.object({
  generatedDocxDataUri: z
    .string()
    .describe('The generated .docx file as a data URI.'),
  replacementsCount: z.number().describe('The number of placeholders that were replaced.'),
});
export type GenerateReportOutput = z.infer<typeof GenerateReportOutputSchema>;

const prepareTemplateData = async (data: any) => {
  const templateData: Record<string, any> = {};
  let replacementCount = 0;

  const countAndSetReplacement = (key: string, value: any) => {
    if (value && typeof value === 'string' && value.trim() !== '' && value.trim() !== 'N/A') {
      const normalizedValue = normalizeNewlines(value);
      templateData[key] = normalizedValue;
      replacementCount++;
    } else if (Array.isArray(value)) {
      templateData[key] = value;
      replacementCount++; // 数组作为一次替换计数
    } else if (value !== undefined && value !== null && value !== '') {
      const normalizedValue = normalizeNewlines(value);
      templateData[key] = normalizedValue;
      replacementCount++;
    } else {
      templateData[key] = '';
    }
  };

  // 1) 根据 initialJsonStructure 的映射填充
  Object.keys(initialJsonStructure as Record<string, unknown>).forEach((sectionKey) => {
    const sectionSchema = (initialJsonStructure as Record<string, any>)[sectionKey] ?? {};
    const dataSection = (data as Record<string, any>)?.[sectionKey];

    Object.keys(sectionSchema as Record<string, any>).forEach((fieldKey: string) => {
      const placeholder = (sectionSchema as Record<string, any>)[fieldKey] as unknown;
      if (typeof placeholder === 'string' && (placeholder as string).startsWith('[extracted_')) {
        const templateKey = (placeholder as string).replace('[extracted_', 'Replace_').replace(']', '');
        const value = dataSection?.[fieldKey];
        countAndSetReplacement(templateKey, value);
      }
    });
  });

  // 2) Instructed By（原结构之外的补充）
  if (data?.Valuation?.['Instructed By']) {
    countAndSetReplacement('Replace_InstructedBy', data.Valuation['Instructed By']);
  }

  // 3) 全局内容（manage-content）
  contentFields.forEach((field) => {
    const templateKey = field.templateKey.replace(/\[|\]/g, '');
    const contentValue = (globalContent as Record<string, any>)[field.name as keyof typeof globalContent];
    countAndSetReplacement(templateKey, contentValue);
  });

  // 4) commentary
  if ((data as any)?.commentary) {
    const placeholderMapping: Record<string, string> = {
      PreviousSale: 'Replace_PreviousSale',
      ContractSale: 'Replace_ContractSale',
      SuppliedDocumentation: 'Replace_SuppliedDoc',
      RecentOrProvided: 'Replace_RecentOrProvided',
      LIM: 'Replace_LIM',
      PC78: 'Replace_PC78',
      OperativeZone: 'Replace_Zone',
    };
    Object.keys((data as any).commentary).forEach((key) => {
      const templateKey = placeholderMapping[key];
      if (templateKey) {
        countAndSetReplacement(templateKey, (data as any).commentary[key]);
      }
    });
  }

  // 5) constructionBrief
  if ((data as any)?.constructionBrief?.finalBrief) {
    countAndSetReplacement('Replace_ConstructionBrief', (data as any).constructionBrief.finalBrief);
  }

  // 6) comparableSales
  if (Array.isArray((data as any)?.comparableSales)) {
    templateData['comparableSales'] = (data as any).comparableSales.map((sale: any) => {
      const n: Record<string, any> = {};
      Object.keys(sale).forEach((k) => {
        const v = sale[k] ?? '';
        n[k] = normalizeNewlines(v);
        if (typeof v === 'string' && v.trim() !== '' && v.trim() !== 'N/A') {
          replacementCount++;
        }
      });
      return n;
    });
  } else {
    templateData['comparableSales'] = [];
  }

  return { templateData, replacementCount };
};

export async function generateReportFromTemplate(
  input: GenerateReportInput
): Promise<GenerateReportOutput> {
  return generateReportFromTemplateFlow(input);
}

const generateReportFromTemplateFlow = ai.defineFlow(
  {
    name: 'generateReportFromTemplateFlow',
    inputSchema: GenerateReportInputSchema,
    outputSchema: GenerateReportOutputSchema,
  },
  async ({ templateFileName, data }) => {
    const templatesDir = path.join(process.cwd(), 'src', 'lib', 'templates');
    const templatePath = path.join(templatesDir, templateFileName);

    try {
        const buffer = await fs.readFile(templatePath);
        const zip = new PizZip(buffer);
        
        const doc = new Docxtemplater(zip, {
          delimiters: {
            start: '[',
            end: ']',
          },
          linebreaks: true,
          nullGetter: () => "", 
        });
        
        const { templateData, replacementCount } = await prepareTemplateData(data);
        
        doc.setData(templateData);

        try {
          doc.render();
          convertSoftBreaksToHardParagraphs(doc.getZip());
        } catch (error: any) {
          console.error('Docxtemplater rendering error:', JSON.stringify(error, null, 2));
          let errorMessage = 'Failed to render the document due to a template error.';
          if (error.properties && error.properties.errors) {
            const firstError = error.properties.errors[0];
            errorMessage += ` Details: ${firstError.properties.explanation} (ID: ${firstError.id})`;
          }
          throw new Error(errorMessage);
        }

        const outputBuffer = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
        });

        const outputBase64 = outputBuffer.toString('base64');
        const outputDataUri = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${outputBase64}`;

        return {
          generatedDocxDataUri: outputDataUri,
          replacementsCount: replacementCount,
        };
    } catch (error: any) {
        console.error(`Error processing template file ${templateFileName}:`, error);
        if(error.code === 'ENOENT') {
            throw new Error(`Template file "${templateFileName}" not found on the server.`);
        }
        throw new Error(error.message || `Failed to read or process the template file.`);
    }
  }
);
