'use server';
/**
 * Insert an image at a TEXT tag like {%report_logo} using
 * docxtemplater-image-module-free.
 *
 * HOW TO USE:
 * 1) In the .docx template, put TEXT tag {%report_logo} at the target position.
 * 2) Call this flow with:
 *    - templateDataUri: data:... of the docx
 *    - imageDataUri: data:image/png;base64,... (or jpeg)
 *    - placeholder: "{%report_logo}"
 *    - width (optional): width in pixels
 *    - height (optional): height in pixels
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

/* eslint-disable @typescript-eslint/no-var-requires */
const ImageModule = require('docxtemplater-image-module-free');
const sizeOfLib = require('image-size');

/* ---- 兼容 image-size 的导出差异（有的返回函数，有的是 { imageSize }） ---- */
const imageSize: (buf: Buffer) => { width?: number; height?: number } = (() => {
  if (typeof sizeOfLib === 'function') return sizeOfLib;
  if (sizeOfLib && typeof sizeOfLib.imageSize === 'function') return sizeOfLib.imageSize;
  return () => ({ width: undefined, height: undefined });
})();

const DEFAULT_WH: [number, number] = [600, 400]; // 兜底尺寸（没给预设且读不到原图尺寸时使用）

/* ----------------------------- Schemas ----------------------------- */
const TestImageReplacementInputSchema = z.object({
  templateDataUri: z.string().describe('docx template as data URI'),
  imageDataUri: z.string().describe('image as data URI, e.g. data:image/png;base64,...'),
  placeholder: z.string().describe('text tag in template, e.g. {%report_logo}'),
  width: z.number().optional().describe('Optional width in pixels.'),
  height: z.number().optional().describe('Optional height in pixels.'),
});
export type TestImageReplacementInput = z.infer<typeof TestImageReplacementInputSchema>;

const TestImageReplacementOutputSchema = z.object({
  generatedDocxDataUri: z.string(),
});
export type TestImageReplacementOutput = z.infer<typeof TestImageReplacementOutputSchema>;

export async function testImageReplacement(
  input: TestImageReplacementInput
): Promise<TestImageReplacementOutput> {
  return testImageReplacementFlow(input);
}

/* ------------------------------ Flow ------------------------------ */
const testImageReplacementFlow = ai.defineFlow(
  {
    name: 'testImageReplacementFlow',
    inputSchema: TestImageReplacementInputSchema,
    outputSchema: TestImageReplacementOutputSchema,
  },
  async ({ templateDataUri, imageDataUri, placeholder, width, height }) => {
    try {
      // 1) 读取模板
      const templateBuffer = Buffer.from(templateDataUri.split(',')[1], 'base64');
      const zip = new PizZip(templateBuffer);

      // 2) 配置免费版图片模块（必须提供 getImage + getSize）
      const imageModule = new ImageModule({
        fileType: 'docx',
        centered: false,

        getImage(tagValue: unknown) {
          if (Buffer.isBuffer(tagValue)) return tagValue;
          if (typeof tagValue === 'string' && tagValue.startsWith('data:')) {
            const b64 = tagValue.split(',')[1] ?? '';
            return Buffer.from(b64, 'base64');
          }
          throw new Error('getImage: expected Buffer or data URI string');
        },

        getSize(img: Buffer /*, _tagValue: unknown, tagName: string */) {
          // ① 若调用方显式传了 width 和 height，优先使用
          if (width && height) {
            return [width, height];
          }

          // ② 否则，尝试读原图像素；失败则回退到 DEFAULT_WH
          try {
            const meta = imageSize(img) || {};
            const w = meta.width ?? DEFAULT_WH[0];
            const h = meta.height ?? DEFAULT_WH[1];
            return [w, h] as [number, number];
          } catch {
            return DEFAULT_WH;
          }
        },
      });

      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        paragraphLoop: true,
        linebreaks: true,
      });

      // 3) 设置数据
      // placeholder 形如 "{%report_logo}"，需要取出键名 "report_logo"
      const key = placeholder.trim().replace(/^\{\%/, '').replace(/\}$/, '');
      doc.setData({ [key]: imageDataUri });

      // 4) 渲染
      doc.render();

      // 5) 导出
      const out = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      const base64 = out.toString('base64');
      return {
        generatedDocxDataUri:
          `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`,
      };
    } catch (err: any) {
      if (err?.properties?.errors?.length) {
        const first = err.properties.errors[0];
        throw new Error(first?.properties?.explanation || first?.id || 'Template render error');
      }
      throw new Error(err?.message || 'Failed to process the document.');
    }
  }
);
