'use server';
/**
 * Reads a .docx template (data URI), replaces image placeholders with images from a server dir,
 * and returns the final .docx as data URI. Robust to tagName changes; uses tagValue (= filename).
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';
import { ImageConfigSchema } from '@/lib/image-options-schema';

// Compatible CJS/ESM import to avoid module instantiation failures being silently ignored by Docxtemplater
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ImageModuleRaw = require('docxtemplater-image-module-free');
const ImageModule = ImageModuleRaw?.default ?? ImageModuleRaw;

/** ========= Configuration: Points to your "server temporary directory" =========
 * You can specify this via the IMAGE_TEMP_DIR environment variable or change the default value below.
 */
const IMAGE_BASE_DIR =
  process.env.IMAGE_TEMP_DIR || path.join(process.cwd(), 'src', 'lib', 'images');

const ALL_IMAGE_CONFIGS_PATH = path.join(process.cwd(), 'src', 'lib', 'image-options.json');


/** Path and existence utilities */
function resolveImagePath(filename: string) {
  const safe = path.basename(filename);
  return path.join(IMAGE_BASE_DIR, safe);
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
  /** Template placeholder. Supports "{%logo}" or "logo" */
  placeholder: z.string(),
  /** Filename in the server directory (filename only, no path) */
  tempFileName: z.string(),
  /** Width in pixels */
  width: z.number(),
  /** Height in pixels */
  height: z.number(),
});

const ReplaceImagesInputSchema = z.object({
  /** .docx template as data URI (e.g., data:application/...;base64,xxxxx) */
  templateDataUri: z.string(),
  /** List of images to replace */
  images: z.array(ImageInfoSchema),
});
export type ReplaceImagesFromTempInput = z.infer<typeof ReplaceImagesInputSchema>;

const ReplaceImagesOutputSchema = z.object({
  /** Output .docx file (data URI) */
  generatedDocxDataUri: z.string(),
  /** Count of successfully replaced images (based on getImage triggers) */
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
      // 1) Parse template
      const base64Part = templateDataUri.split(',')[1] ?? '';
      const templateBuffer = Buffer.from(base64Part, 'base64');
      if (!templateBuffer?.length) throw new Error('Invalid templateDataUri: empty buffer.');
      const zip = new PizZip(templateBuffer);

      // 2) Prepare mappings (key = placeholder without brackets)
      const valueByKey = new Map<string, string>(); // key -> filename
      const sizeByKey = new Map<string, { width: number; height: number }>(); // key -> size

      for (const img of images) {
        let key = img.placeholder.trim();
        if (key.startsWith('{%')) key = key.slice(2);
        if (key.endsWith('}')) key = key.slice(0, -1);
        key = key.trim();

        valueByKey.set(key, img.tempFileName);
        sizeByKey.set(key, { width: img.width, height: img.height });

        // Pre-check file existence
        await assertExists(resolveImagePath(img.tempFileName));
      }

      // 3) Build image module (synchronously returns Buffer; prefers tagValue=filename, then falls back to tagName)
      let replacedCount = 0;
      const imageModule = new ImageModule({
        fileType: 'docx',
        centered: false,

        getImage: (tagValue: unknown, tagName: string) => {
          let file: string | undefined =
            typeof tagValue === 'string' && tagValue.trim() ? tagValue.trim() : undefined;
          
          if (!file) { // Fallback to tagName if tagValue is empty or not a string
             file = valueByKey.get(tagName);
          }

          if (!file) { // If still no file, it means the placeholder is not in our image list. We return empty buffer to avoid error.
            return Buffer.from([]);
          }

          const abs = resolveImagePath(file);
          if (!fs.existsSync(abs)) throw new Error(`Image not found at ${abs}`);

          replacedCount += 1;
          return fs.readFileSync(abs); // **Must return Buffer synchronously**
        },

        getSize: (_img: Buffer, tagValue: unknown, tagName: string) => {
          let s = sizeByKey.get(tagName);
          if (!s && typeof tagValue === 'string') {
            const base = path.basename(tagValue).replace(/\.[^.]+$/, '');
            s = sizeByKey.get(base);
          }
          return s ? [s.width, s.height] : [300, 200]; // fallback
        },
      });

      // 4) Render (disable linebreaks to prevent paragraph structure modification that could break imageModule)
      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        delimiters: { start: '{%', end: '}' },
        paragraphLoop: true,
        linebreaks: false,
        // For any non-image tag that is not resolved, replace it with an empty string to prevent errors.
        nullGetter: () => '',
      });
      
      // Load all possible image configs to ensure all placeholders are handled
      const allConfigsContent = await fsp.readFile(ALL_IMAGE_CONFIGS_PATH, 'utf-8');
      const allImageConfigs = ImageConfigSchema.array().parse(JSON.parse(allConfigsContent));

      // Build data object for docxtemplater.
      // If an image is provided, its value is the filename.
      // If not, its value is an empty string to clear the tag.
      const data: Record<string, unknown> = {};
      allImageConfigs.forEach(config => {
         let key = config.placeholder.trim();
         if (key.startsWith('{%')) key = key.slice(2);
         if (key.endsWith('}')) key = key.slice(0, -1);
         key = key.trim();
         
         data[key] = valueByKey.get(key) || ''; // Use filename or empty string
      });

      doc.setData(data);
      doc.render();

      // 5) Output
      const out = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      const base64 = out.toString('base64');

      return {
        generatedDocxDataUri:
          `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`,
        imagesReplacedCount: replacedCount,
      };
    } catch (err: any) {
      // Docxtemplater error structure handling
      if (err?.properties?.errors?.length) {
        const first = err.properties.errors[0];
        const context = first?.properties?.context;
        const tagName = context ? `Tag: ${JSON.stringify(context)}` : '';
        throw new Error(
          first?.properties?.explanation || first?.id || `Template render error. ${tagName}`
        );
      }
      throw new Error(err?.message || 'Failed to process the document for image replacement.');
    }
  }
);
