'use server';
/**
 * 生成 Word 报告（稳定版：软回车 -> 硬回车，保样式，避坑）
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

/* -----------------------------
 * Helpers
 * ----------------------------- */

// 统一换行：把字面量 "\n" 也转为真实换行
const normalizeNewlines = (s: unknown): string =>
  s !== undefined && s !== null
    ? String(s).replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    : '';

// 统计工具
const _count = (src: string, re: RegExp): number => (src.match(re) || []).length;

// 调试：统计软回车数量 & 是否出现危险序列
const logBreakStats = (zip: any, stage: string): void => {
  const f = zip.file('word/document.xml');
  const docXml: string = f ? f.asText() : '';
  const brCount = _count(docXml, /<w:(?:br|cr)\b(?![^>]*\bw:type=)[^/]*\/>/g);
  const dangerous = _count(docXml, /<\/w:t><\/w:r><\/w:p><w:p><w:r><w:t>/g);
  console.log(`[Docx ${stage}] brCount=${brCount}  dangerousCloseOpenWT=${dangerous}`);
};

/**
 * 稳定版：把 <w:br/> / <w:cr/>（软回车）升级为“硬回车”（新段落）
 * - 段落级处理，复制 <w:pPr> 保留段落样式（缩进/段前段后/对齐/编号）
 * - 跳过风险容器（w:hyperlink / w:sdt / w:ins / w:del / w:smartTag / w:fldSimple）
 * - 不动分页/分栏 (<w:br w:type="page|column">)
 * - 处理 </w:r> 边界：若软回车后紧跟 </w:r>，连同它一起吞掉，避免新段开头孤儿 </w:r>
 * - 默认只处理正文 document.xml；如需连页眉页脚/脚注也处理，把 includeHeadersFooters 设为 true
 */
const convertSoftBreaksToHardParagraphs = (
  zip: any,
  opts: { includeHeadersFooters?: boolean } = {}
): void => {
  const includeHF: boolean = !!opts.includeHeadersFooters;

  const targets: string[] = Object.keys(zip.files).filter((name: string) =>
    includeHF
      ? /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(name)
      : /^word\/document\.xml$/.test(name)
  );

  const PARAGRAPH_BLOCK: RegExp = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;        // 整段
  const PPR_BLOCK: RegExp       = /<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/;     // 段落样式
  const SOFT_BREAK_RE: RegExp   = /<w:(?:br|cr)\b(?![^>]*\bw:type=)[^/]*\/>/g; // 普通软回车（排除 page/column）
  const RISKY_TAGS: string[]    = ['w:hyperlink', 'w:sdt', 'w:ins', 'w:del', 'w:smartTag', 'w:fldSimple'];

  targets.forEach((name: string) => {
    const file = zip.file(name);
    if (!file) return;

    let xml: string = file.asText();
    let fileChanged = false;

    // 逐段处理，避免破坏更外层结构
    xml = xml.replace(PARAGRAPH_BLOCK, (pBlock: string): string => {
      if (!SOFT_BREAK_RE.test(pBlock)) return pBlock;

      const pPrMatch: RegExpMatchArray | null = pBlock.match(PPR_BLOCK);
      const pPr: string = pPrMatch ? pPrMatch[0] : '';

      let out = '';
      let last = 0;
      let changed = false;

      // 用独立的 RegExp 实例逐个 exec
      const re = new RegExp(SOFT_BREAK_RE.source, SOFT_BREAK_RE.flags);
      let m: RegExpExecArray | null;

      while ((m = re.exec(pBlock)) !== null) {
        const matchText: string = m[0];
        const matchStart: number = m.index;
        const matchEnd: number = m.index + matchText.length;

        const before: string = pBlock.slice(0, matchStart);

        // 是否处在风险容器里：最近一次 <tag> 尚未被 </tag> 关闭
        const inRisky: boolean = RISKY_TAGS.some((tag: string) => {
          const openIdx = before.lastIndexOf('<' + tag);
          if (openIdx === -1) return false;
          const closeIdx = before.lastIndexOf('</' + tag + '>');
          return closeIdx < openIdx;
        });

        out += pBlock.slice(last, matchStart);

        if (inRisky) {
          // 容器内保持软回车不动
          out += matchText;
          last = matchEnd;
          continue;
        }

        // 判断 br 之后是否紧跟 </w:r>，若是就一并吞掉
        const afterSlice: string = pBlock.slice(matchEnd, matchEnd + 64);
        const CLOSE_R_RE: RegExp = /^\s*<\/w:r>/;
        const hasCloseR: boolean = CLOSE_R_RE.test(afterSlice);
        const swallowLen: number = hasCloseR ? (afterSlice.match(CLOSE_R_RE)![0].length) : 0;

        // 替换为：关 run + 关段 → 开新段(带 pPr) + （如需）开新 run
        if (hasCloseR) {
          out += `</w:r></w:p><w:p>${pPr}`;
        } else {
          out += `</w:r></w:p><w:p>${pPr}<w:r>`;
        }

        last = matchEnd + swallowLen; // 跳过 <w:br/> 及可能紧随的 </w:r>
        changed = true;
      }

      if (!changed) return pBlock;          // 本段未变，原样返回
      fileChanged = true;                   // 标记本 XML 文件确实发生了变化
      out += pBlock.slice(last);            // 补上尾部
      return out;
    });

    if (fileChanged) {
      zip.file(name, xml);
    }
  });
};

/* -----------------------------
 * Schemas
 * ----------------------------- */

const GenerateReportInputSchema = z.object({
  templateFileName: z.string().describe('The file name of the .docx template stored on the server.'),
  data: z.any().describe('The JSON data to populate the template with.'),
});
export type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

const GenerateReportOutputSchema = z.object({
  generatedDocxDataUri: z.string().describe('The generated .docx file as a data URI.'),
  replacementsCount: z.number().describe('The number of placeholders that were replaced.'),
});
export type GenerateReportOutput = z.infer<typeof GenerateReportOutputSchema>;

/* -----------------------------
 * Data preparation for Docxtemplater
 * ----------------------------- */

const prepareTemplateData = async (data: any) => {
  const templateData: Record<string, any> = {};
  let replacementCount = 0;

  const countAndSetReplacement = (key: string, value: any): void => {
    const normalizedValue = normalizeNewlines(value);
    templateData[key] = normalizedValue;

    if (Array.isArray(value)) {
      // 数组：只要数组里有任意项含非空值，就记一次
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

  // 1) initialJsonStructure 映射
  Object.keys(initialJsonStructure as Record<string, unknown>).forEach((sectionKey: string) => {
    const sectionSchema: Record<string, any> = (initialJsonStructure as Record<string, any>)[sectionKey] ?? {};
    const dataSection: Record<string, any> | undefined = (data as Record<string, any>)?.[sectionKey];

    Object.keys(sectionSchema).forEach((fieldKey: string) => {
      const placeholder = sectionSchema[fieldKey] as unknown;
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
  contentFields.forEach((field: any) => {
    const templateKey: string = String(field.templateKey).replace(/\[|\]/g, '');
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
      ZoningOperative: 'Replace_ZoningOperative',
      ZoningPlanChange78: 'Replace_ZoningPlanChange78',
    };
    Object.keys((data as any).commentary).forEach((key: string) => {
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
    templateData['comparableSales'] = (data as any).comparableSales.map((sale: Record<string, any>) => {
      const n: Record<string, any> = {};
      Object.keys(sale).forEach((k: string) => {
        const v = sale[k] ?? '';
        n[k] = normalizeNewlines(v);
      });
      return n;
    });
    countAndSetReplacement('comparableSales', (data as any).comparableSales);
  } else {
    templateData['comparableSales'] = [];
  }

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

    try {
      const buffer = await fs.readFile(templatePath);
      const zip = new PizZip(buffer);

      const doc = new Docxtemplater(zip, {
        delimiters: { start: '[', end: ']' },
        linebreaks: true, // 先把 \n 变 <w:br/>，随后升级为新段落
        nullGetter: () => '',
      });

      const { templateData, replacementCount } = await prepareTemplateData(data);
      doc.setData(templateData);

      try {
        // ① 渲染
        doc.render();

        // 调试统计（渲染后）
        logBreakStats(doc.getZip(), 'after-render');

        // ② 升级为硬回车（默认仅正文；如需头脚也处理，把 includeHeadersFooters 调为 true）
        convertSoftBreaksToHardParagraphs(doc.getZip(), { includeHeadersFooters: false });

        // 调试统计（升级后）
        logBreakStats(doc.getZip(), 'after-upgrade');
      } catch (error: any) {
        console.error('Docxtemplater rendering error:', JSON.stringify(error, null, 2));
        let errorMessage = 'Failed to render the document due to a template error.';
        if (error.properties && error.properties.errors) {
          const firstError = error.properties.errors[0];
          errorMessage += ` Details: ${firstError.properties.explanation} (ID: ${firstError.id})`;
        }
        throw new Error(errorMessage);
      }

      // ③ 导出
      const outputBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      const outputBase64 = outputBuffer.toString('base64');
      const outputDataUri =
        `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${outputBase64}`;

      return {
        generatedDocxDataUri: outputDataUri,
        replacementsCount: replacementCount,
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

    