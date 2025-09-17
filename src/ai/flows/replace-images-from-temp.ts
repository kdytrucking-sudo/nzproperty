'use server';
/**
 * All-in-one .docx image+text renderer (triple-attempt fallback).
 * - 支持图片+文本占位符
 * - 先用 `{% ... }` + linebreaks:false；不行→ linebreaks:true；还不行→ `{{ ... }}`
 * - 严格同步读图；自动统计 getImage 触发次数
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';

// 兼容 CJS/ESM 的导入
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ModRaw = require('docxtemplater-image-module-free');
const ImageModuleCtor: any =
  (ModRaw && (ModRaw.default || ModRaw.ImageModule || ModRaw)) || ModRaw;

const IMAGE_BASE_DIR =
  process.env.IMAGE_TEMP_DIR || path.join(process.cwd(), 'src', 'lib', 'images');

function resolveImagePath(filename: string) {
  const safe = path.basename(filename);
  return path.join(IMAGE_BASE_DIR, safe);
}
async function assertExists(absPath: string) {
  try { await fsp.access(absPath); }
  catch { throw new Error(`Image not found: ${path.basename(absPath)}`); }
}
function normKey(raw: string): string {
  let k = (raw || '').trim();
  if (k.startsWith('{%')) k = k.slice(2);
  if (k.endsWith('}')) k = k.slice(0, -1);
  if (k.startsWith('{{')) k = k.slice(2);
  if (k.endsWith('}}')) k = k.slice(0, -2);
  return k.trim();
}

/* ----------------------------- Schemas ----------------------------- */
const ImageInfoSchema = z.object({
  placeholder: z.string(),       // "{%logo}" 或 "logo" 或 "{{logo}}"
  tempFileName: z.string(),      // 仅文件名
  width: z.number(),             // 像素
  height: z.number(),            // 像素
});
const ReplaceImagesInputSchema = z.object({
  templateDataUri: z.string(),
  images: z.array(ImageInfoSchema).default([]),
  textData: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type ReplaceImagesFromTempInput = z.infer<typeof ReplaceImagesInputSchema>;

const ReplaceImagesOutputSchema = z.object({
  generatedDocxDataUri: z.string(),
  imagesReplacedCount: z.number(),
});
export type ReplaceImagesFromTempOutput = z.infer<typeof ReplaceImagesOutputSchema>;

export async function replaceImagesFromTemp(
  input: ReplaceImagesFromTempInput
): Promise<ReplaceImagesFromTempOutput> {
  return replaceImagesFromTempFlow(input);
}

/* ------------------------------ Flow ------------------------------ */
const replaceImagesFromTempFlow = ai.defineFlow(
  {
    name: 'replaceImagesFromTempFlow',
    inputSchema: ReplaceImagesInputSchema,
    outputSchema: ReplaceImagesOutputSchema,
  },
  async ({ templateDataUri, images, textData }) => {
    // 解析模板 buffer
    const base64 = templateDataUri.split(',')[1] ?? '';
    const tplBuf = Buffer.from(base64, 'base64');
    if (!tplBuf.length) throw new Error('Invalid templateDataUri: empty buffer');

    // 预处理映射
    const imgVal = new Map<string, string>();           // key -> 文件名（作为 tagValue）
    const imgSize = new Map<string, {w:number; h:number}>(); // key -> 尺寸
    for (const it of images) {
      const k = normKey(it.placeholder);
      imgVal.set(k, it.tempFileName);
      imgSize.set(k, { w: it.width, h: it.height });
      await assertExists(resolveImagePath(it.tempFileName));
    }
    const txtVal = new Map<string, string|number|boolean>();
    if (textData) for (const [kRaw,v] of Object.entries(textData)) txtVal.set(normKey(kRaw), v);

    // 封装一次渲染尝试
    const tryRender = (opts: {delims: {start:string; end:string}, linebreaks: boolean}) => {
      const zip = new PizZip(tplBuf);
      let count = 0;

      const imageModule = new ImageModuleCtor({
        fileType: 'docx',
        centered: false,
        getImage: (tagValue: unknown, tagName: string) => {
          let file =
            (typeof tagValue === 'string' && tagValue.trim()) ? tagValue.trim() :
            imgVal.get(tagName) ?? imgVal.get(normKey(tagName));
          if (!file) throw new Error(`Image tag "${tagName}" has no value`);
          const abs = resolveImagePath(file);
          if (!fs.existsSync(abs)) throw new Error(`Image not found at ${abs}`);
          count += 1;
          return fs.readFileSync(abs); // 必须同步
        },
        getSize: (_buf: Buffer, tagValue: unknown, tagName: string) => {
          let s = imgSize.get(tagName) || imgSize.get(normKey(tagName));
          if (!s && typeof tagValue === 'string') {
            const base = path.basename(tagValue).replace(/\.[^.]+$/,'');
            s = imgSize.get(base);
          }
          return s ? [s.w, s.h] : [300, 200];
        },
      });

      const knownImg = new Set(imgVal.keys());
      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        delimiters: opts.delims,
        paragraphLoop: true,
        linebreaks: opts.linebreaks,
        nullGetter: (part: any) => {
          const t = part?.tag;
          if (t && knownImg.has(t)) throw new Error(`Image placeholder "${t}" has no value`);
          return ''; // 其他未知标签置空，不阻断
        },
      });

      // setData：文本 + 图片（图片把文件名丢进去作为 tagValue）
      const data: Record<string, any> = {};
      for (const [k,v] of txtVal.entries()) data[k] = v;
      for (const [k,v] of imgVal.entries()) data[k] = v;
      doc.setData(data);

      doc.render();
      const out = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      return { buf: out, count };
    };

    // 三段尝试：优先你的老习惯；不行再换
    const attempts = [
      { delims: { start: '{%', end: '}' },  linebreaks: false },
      { delims: { start: '{%', end: '}' },  linebreaks: true  },
      { delims: { start: '{{', end: '}}' }, linebreaks: true  },
    ] as const;

    let lastErr: any = null;
    for (const a of attempts) {
      try {
        const { buf, count } = tryRender(a);
        // 如果你确实传了 images，但 count=0，多半是占位符分隔符不匹配或模板结构问题
        if (images.length > 0 && count === 0) {
          // 继续尝试下一种配置
          lastErr = new Error('Image module not triggered (0 replacements)');
          continue;
        }
        const b64 = buf.toString('base64');
        return {
          generatedDocxDataUri:
            `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${b64}`,
          imagesReplacedCount: count,
        };
      } catch (e) {
        lastErr = e;
        // 换下一种策略
      }
    }
    throw (lastErr ?? new Error('Rendering failed'));
  }
);