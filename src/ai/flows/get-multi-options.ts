
'use server';
/**
 * @fileOverview Retrieves multi-option configurations from a JSON file.
 */

import fs from 'fs/promises';
import path from 'path';
import { MultiOptionsSchema, type MultiOptionsData } from '@/lib/multi-options-schema';

export async function getMultiOptions(): Promise<MultiOptionsData> {
    const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'multi-options.json');
    try {
      const jsonString = await fs.readFile(jsonFilePath, 'utf-8');
      const data = JSON.parse(jsonString);
      return MultiOptionsSchema.parse(data);
    } catch (error: any) {
       // If the file doesn't exist, create it with a default empty array.
      if (error.code === 'ENOENT') {
        const defaultOptions: MultiOptionsData = [];
        await fs.writeFile(jsonFilePath, JSON.stringify(defaultOptions, null, 2), 'utf-8');
        return defaultOptions;
      }
      console.error('Failed to get multi-options:', error);
      throw new Error(`Failed to read or parse multi-options file: ${error.message}`);
    }
}
