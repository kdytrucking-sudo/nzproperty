'use server';
/**
 * @fileOverview Retrieves image configurations from a JSON file.
 */

import fs from 'fs/promises';
import path from 'path';
import { ImageOptionsSchema, type ImageOptionsData } from '@/lib/image-options-schema';

export async function getImageOptions(): Promise<ImageOptionsData> {
    const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'image-options.json');
    try {
      const jsonString = await fs.readFile(jsonFilePath, 'utf-8');
      const data = JSON.parse(jsonString);
      return ImageOptionsSchema.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        const defaultOptions: ImageOptionsData = [];
        await fs.writeFile(jsonFilePath, JSON.stringify(defaultOptions, null, 2), 'utf-8');
        return defaultOptions;
      }
      console.error('Failed to get image options:', error);
      throw new Error(`Failed to read or parse image-options.json file: ${error.message}`);
    }
}
