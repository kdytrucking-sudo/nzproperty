
'use server';
/**
 * @fileOverview Retrieves multi-option configurations from a JSON file.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { MultiOptionsSchema, type MultiOptionsData } from '@/lib/multi-options-schema';

export async function getMultiOptions(): Promise<MultiOptionsData> {
    return getMultiOptionsFlow();
}

const getMultiOptionsFlow = ai.defineFlow(
    {
        name: 'getMultiOptionsFlow',
        inputSchema: z.void(),
        outputSchema: MultiOptionsSchema,
    },
    async () => {
        const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'multi-options.json');
        try {
            const jsonString = await fs.readFile(jsonFilePath, 'utf-8');
            const data = JSON.parse(jsonString);
            return MultiOptionsSchema.parse(data);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                const defaultOptions: MultiOptionsData = [];
                await fs.writeFile(jsonFilePath, JSON.stringify(defaultOptions, null, 2), 'utf-8');
                return defaultOptions;
            }
            console.error('Failed to get multi-options:', error);
            throw new Error(`Failed to read or parse multi-options file: ${error.message}`);
        }
    }
);
