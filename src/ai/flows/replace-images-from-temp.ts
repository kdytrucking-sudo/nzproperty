
'use server';
/**
 * Reads a .docx template, replaces placeholders with images from a temp/permanent dir,
 * and returns the final file.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import path from 'path';
import fs from 'fs';               // 同步 API
import { promises as fsp } from 'fs'; // 异步 API（仅用于存在性检查）

/* eslint-disable @typescript-eslint/no-var-requires */
const ImageModule = require('docxtemplater-image-module-free');

/** 👇 把这里改成你的“服务器临时目录” */
const IMAGE_BASE_DIR =
  process.env.IMAGE_TEMP_DIR || path.join(process.cwd(), 'src', 'lib', 'images');

function resolveImagePath(filename: string) {
  const safeName = path.basename(filename);
  return path.join(IMAGE_BASE_DIR, safeName);
}

async function assertExists(absPath: string) {
  try {
    await fsp.access(absPath);
  } catch {
    throw new Error(`Image not found: ${path.basename(absPath)}`);
  }
}

/* ----------------------------- Schemas ----------------------------- */
const ImageInfoSchema = z.object({
  placeholder: z.string().describe('Text tag in template, e.g. {%report_logo}'),
  tempFileName: z.string().describe('File name on server (in temp/permanent dir).'),
  width: z.number().describe('Width in pixels'),
  height: z.number().describe('Height in pixels'),
});

const ReplaceImagesInputSchema = z.object({
  templateDataUri: z.string().describe('The .docx template as a data URI.'),
  images: z.array(ImageInfoSchema).describe('Images to replace'),
});
export type ReplaceImagesFromTempInput = z.infer<typeof ReplaceImagesInputSchema>;

const ReplaceImagesOutputSchema = z.object({
  generatedDocxDataUri: z.string().describe('The final .docx file as data URI'),
  imagesReplacedCount: z.number(),
});
export type ReplaceImagesFromTempOutput = z.infer<typeof ReplaceImagesOutputSchema>;

/* ------------------------------ API ------------------------------ */
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
  async ({ templateDataUri, images }) => {
    try {
      const base64Part = templateDataUri.split(',')[1] ?? '';
      const templateBuffer = Buffer.from(base64Part, 'base64');
      if (templateBuffer.length === 0) {
        throw new Error('Invalid templateDataUri: empty buffer');
      }

      const zip = new PizZip(templateBuffer);

      // 用 tagValue 作为“线索”更稳：把文件名塞进数据里
      const valueByKey = new Map<string, string>();
      const sizeByKey = new Map<string, { width: number; height: number }>();

      for (const img of images) {
        let key = img.placeholder.trim();
        if (key.startsWith('{%')) key = key.slice(2);
        if (key.endsWith('}')) key = key.slice(0, -1);
        key = key.trim();

        valueByKey.set(key, img.tempFileName);
        sizeByKey.set(key, { width: img.width, height: img.height });

        // 运行前先做存在性检查，避免运行期才爆
        const p = resolveImagePath(img.tempFileName);
        await assertExists(p);
      }

      const imageModule = new ImageModule({
        fileType: 'docx',
        centered: false,

        // 【必须同步返回 Buffer】不要返回 Promise
        getImage: (tagValue: unknown, tagName: string) => {
          let fileName: string | undefined;

          if (typeof tagValue === 'string' && tagValue.trim()) {
            fileName = tagValue.trim();
          } else {
            fileName = valueByKey.get(tagName);
          }

          if (!fileName) {
            throw new Error(`Image tag "${tagName}" has no value`);
          }

          const abs = resolveImagePath(fileName);
          if (!fs.existsSync(abs)) {
            throw new Error(`Image not found at ${abs}`);
          }
          return fs.readFileSync(abs);
        },

        getSize: (_img: Buffer, tagValue: unknown, tagName: string) => {
          // 先按 tagName 找尺寸，不行再用文件名（去扩展名）兜底
          let size = sizeByKey.get(tagName);
          if (!size && typeof tagValue === 'string') {
            const base = path.basename(tagValue).replace(/\.[^.]+$/, '');
            size = sizeByKey.get(base);
          }
          if (!size) return [300, 200];
          return [size.width, size.height];
        },
      });

      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        delimiters: { start: '{%', end: '}' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '', // Ignore missing text tags
      });

      // 把“占位符 -> 文件名”作为数据灌入，让 tagValue = 文件名
      const data: Record<string, unknown> = {};
      for (const [k, v] of valueByKey.entries()) data[k] = v;
      doc.setData(data);

      doc.render();

      const out = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      const base64 = out.toString('base64');

      return {
        generatedDocxDataUri:
          `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`,
        imagesReplacedCount: images.length,
      };
    } catch (err: any) {
      if (err?.properties?.errors?.length) {
        const first = err.properties.errors[0];
        throw new Error(first?.properties?.explanation || first?.id || 'Template render error during image replacement.');
      }
      throw new Error(err?.message || 'Failed to process the document for image replacement.');
    }
  }
);
