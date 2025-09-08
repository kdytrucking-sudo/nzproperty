
'use server';
/**
 * Generates a Word report from a template, replacing only text placeholders.
 * The output is saved to a temporary file on the server.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import globalContent from '@/lib/global-content.json';
import { contentFields } from '@/lib/content-config';
import { multiOptionsSchema, type MultiOptionsData } from '@/lib/multi-options-schema';

/* -----------------------------
 * Schemas
 * ----------------------------- */

const GenerateReportInputSchema = z.object({
  templateFileName: z.string().describe('The file name of the .docx template stored on the server.'),
  data: z.any().describe('The JSON data to populate the template with.'),
});
export type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

const GenerateReportOutputSchema = z.object({
  tempFileName: z.string().describe('The unique name of the temporary docx file saved on the server.'),
  replacementsCount: z.number().describe('The number of text placeholders that were replaced.'),
});
export type GenerateReportOutput = z.infer<typeof GenerateReportOutputSchema>;

/* -----------------------------
 * Helpers
 * ----------------------------- */

const normalizeNewlines = (s: unknown): string =>
  s !== undefined && s !== null
    ? String(s).replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    : '';

const convertSoftBreaksToHardParagraphs = (zip: any): void => {
  const file = zip.file('word/document.xml');
  if (!file) return;

  let xml = file.asText();
  const softBreak = /<w:br\/>/g;
  const paragraphBlock = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  const pPrBlock = /<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/;

  xml = xml.replace(paragraphBlock, (pBlock: string) => {
    if (!softBreak.test(pBlock)) return pBlock;
    const pPr = pBlock.match(pPrBlock)?.[0] || '';
    const parts = pBlock.replace(/<\/?w:p[^>]*>/g, '').split(/<w:br\/>/g);

    return parts
      .map((part, index) => {
        let content = part.trim();
        if (index > 0 && !content.startsWith('<w:r>')) {
          content = `<w:r><w:t>${content}</w:t></w:r>`;
        } else if (index === 0 && !content.endsWith('</w:r>')) {
          // This logic might need refinement based on actual docx structure
        }
        return `<w:p>${pPr}${content}</w:p>`;
      })
      .join('');
  });

  zip.file('word/document.xml', xml);
};

/* -----------------------------
 * Data preparation for Docxtemplater
 * ----------------------------- */

const prepareTemplateData = async (data: any) => {
  const templateData: Record<string, any> = {};
  let replacementCount = 0;
  
  const jsonStructurePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
  const jsonString = await fs.readFile(jsonStructurePath, 'utf-8');
  const jsonStructure = JSON.parse(jsonString);


  const countAndSetReplacement = (key: string, value: any): void => {
    const normalizedValue = normalizeNewlines(value);
    const finalKey = key.startsWith('Replace_') ? key : `Replace_${key}`;
    templateData[finalKey] = normalizedValue;

    if (Array.isArray(value)) {
      const hasContent = value.some((item: any) =>
        Object.values(item ?? {}).some((v: any) =>
          typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null && v !== ''
        )
      );
      if (hasContent) replacementCount++;
    } else if (typeof value === 'string') {
      if (value.trim() !== '' && value.trim() !== 'N/A') replacementCount++;
    } else if (value !== undefined && value !== null && value !== '') {
      replacementCount++;
    }
  };
  
  Object.keys(jsonStructure).forEach((sectionKey) => {
    const sectionSchema = jsonStructure[sectionKey] || {};
    const dataSection = data?.[sectionKey];

    if (dataSection) {
      Object.keys(dataSection).forEach((fieldKey) => {
        const fieldConfig = sectionSchema[fieldKey];
        if (fieldConfig && typeof fieldConfig === 'object' && fieldConfig.placeholder) {
          const templateKey = fieldConfig.placeholder.replace(/\[|\]/g, '');
          const value = dataSection[fieldKey];
          countAndSetReplacement(templateKey, value);
        }
      });
    }
  });

  contentFields.forEach((field: any) => {
    const templateKey: string = String(field.templateKey).replace(/\[|\]/g, '');
    const contentValue = (globalContent as Record<string, any>)[field.name as keyof typeof globalContent];
    countAndSetReplacement(templateKey, contentValue);
  });

  if ((data as any)?.commentary) {
    const placeholderMapping: Record<string, string> = {
      PurposeofValuation: 'Replace_PurposeofValuation', PrincipalUse: 'Replace_PrincipalUse',
      PreviousSale: 'Replace_PreviousSale', ContractSale: 'Replace_ContractSale',
      SuppliedDocumentation: 'Replace_SuppliedDoc', RecentOrProvided: 'Replace_RecentOrProvided',
      LIM: 'Replace_LIM', PC78: 'Replace_PC78', OperativeZone: 'Replace_Zone',
      ZoningOptionOperative: 'Replace_ZoningOptionOperative', ZoningOptionPC78: 'Replace_ZoningOptionPC78',
      ConditionAndRepair: 'Replace_ConditionAndRepair',
    };
    Object.keys((data as any).commentary).forEach((key: string) => {
      const templateKey = placeholderMapping[key];
      if (templateKey) countAndSetReplacement(templateKey, (data as any).commentary[key]);
    });
  }

  if ((data as any)?.constructionBrief?.finalBrief) {
    countAndSetReplacement('Replace_ConstructionBrief', (data as any).constructionBrief.finalBrief);
  }

  if ((data as any)?.marketValuation) {
    if ((data as any).marketValuation.marketValue) countAndSetReplacement('Replace_MarketValue', (data as any).marketValuation.marketValue);
    if ((data as any).marketValuation.marketValuation) countAndSetReplacement('Replace_MarketValuation', (data as any).marketValuation.marketValuation);
    if ((data as any).marketValuation.improvementsValueByValuer) countAndSetReplacement('Replace_ImprovementValueByValuer', (data as any).marketValuation.improvementsValueByValuer);
    if ((data as any).marketValuation.landValueByValuer) countAndSetReplacement('Replace_LandValueByValuer', (data as any).marketValuation.landValueByValuer);
    if ((data as any).marketValuation.chattelsValueByValuer) countAndSetReplacement('Replace_ChattelsByValuer', (data as any).marketValuation.chattelsValueByValuer);
    if ((data as any).marketValuation.marketValueByValuer) countAndSetReplacement('Replace_MarketValueByValuer', (data as any).marketValuation.marketValueByValuer);
  }

  if (Array.isArray((data as any)?.comparableSales)) {
    templateData['comparableSales'] = (data as any).comparableSales.map((sale: Record<string, any>) => {
      const n: Record<string, any> = {};
      Object.keys(sale).forEach((k: string) => { n[k] = normalizeNewlines(sale[k] ?? ''); });
      return n;
    });
    countAndSetReplacement('comparableSales', (data as any).comparableSales);
  } else {
    templateData['comparableSales'] = [];
  }

  if ((data as any)?.statutoryValuation) {
    countAndSetReplacement('Replace_LandValueFromWeb', (data as any).statutoryValuation.landValueByWeb);
    countAndSetReplacement('Replace_ValueofImprovementsFromWeb', (data as any).statutoryValuation.improvementsValueByWeb);
    countAndSetReplacement('Replace_RatingValuationFromWeb', (data as any).statutoryValuation.ratingValueByWeb);
  }

  Object.keys(data).forEach(key => {
    if (key.startsWith('Replace_')) {
      const alreadyHandled = [
        'Replace_PurposeofValuation', 'Replace_PrincipalUse', 'Replace_PreviousSale', 'Replace_ContractSale',
        'Replace_SuppliedDoc', 'Replace_RecentOrProvided', 'Replace_LIM', 'Replace_PC78', 'Replace_Zone',
        'Replace_ZoningOptionOperative', 'Replace_ZoningOptionPC78', 'Replace_ConditionAndRepair',
        'Replace_ConstructionBrief', 'Replace_MarketValue', 'Replace_MarketValuation', 'Replace_ImprovementValueByValuer',
        'Replace_LandValueByValuer', 'Replace_ChattelsByValuer', 'Replace_MarketValueByValuer',
        'Replace_LandValueFromWeb', 'Replace_ValueofImprovementsFromWeb', 'Replace_RatingValuationFromWeb'
      ].includes(key);

      const isFromJsonStructure = Object.values(jsonStructure).some((section: any) => 
        Object.values(section).some((field: any) => field.placeholder?.replace(/\[|\]/g, '') === key)
      );

      if (!alreadyHandled && !isFromJsonStructure) {
         countAndSetReplacement(key, data[key]);
      }
    }
  });

  return { templateData, replacementCount };
};

/* -----------------------------
 * Flow
 * ----------------------------- */

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
    const tmpDir = path.join(process.cwd(), 'tmp');

    try {
      await fs.mkdir(tmpDir, { recursive: true });

      const buffer = await fs.readFile(templatePath);
      const zip = new PizZip(buffer);

      const doc = new Docxtemplater(zip, {
        delimiters: { start: '[', end: ']' },
        linebreaks: true,
        nullGetter: () => '',
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

      const outputBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      
      // Save to a temporary file instead of returning data URI
      const tempFileName = `${crypto.randomUUID()}.docx`;
      const tempFilePath = path.join(tmpDir, tempFileName);
      await fs.writeFile(tempFilePath, outputBuffer);

      return {
        tempFileName,
        replacementsCount,
      };
    } catch (error: any) {
      console.error(`Error processing template file ${templateFileName}:`, error);
      if (error.code === 'ENOENT') {
        throw new Error(`Template file "${templateFileName}" not found on the server.`);
      }
      throw new Error(error.message || 'Failed to read or process the template file.');
    }
  }
);
