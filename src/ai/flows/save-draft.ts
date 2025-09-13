'use server';
/**
 * @fileOverview Saves or updates a draft to the drafts.json file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { DraftSchema, DraftsFileSchema } from '@/lib/drafts-schema';

const SaveDraftInputSchema = z.object({
  formData: z.any(),
});

export async function saveDraft(input: { formData: any }): Promise<void> {
  return saveDraftFlow(input);
}

// Helper to get place_id from Google Maps Geocoding API
async function getPlaceId(address: string): Promise<string> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured on the server.');
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      return data.results[0].place_id;
    }
    
    if (data.status === 'ZERO_RESULTS') {
      // If Google can't find it, we'll use a hash of the address as a fallback.
      // This is not ideal but better than nothing for uniqueness.
      const crypto = await import('crypto');
      return `fallback_${crypto.createHash('md5').update(address.toLowerCase().trim()).digest('hex')}`;
    }

    throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || 'No results'}`);
}


const saveDraftFlow = ai.defineFlow(
  {
    name: 'saveDraftFlow',
    inputSchema: SaveDraftInputSchema,
    outputSchema: z.void(),
  },
  async ({ formData }) => {
    const filePath = path.join(process.cwd(), 'src/lib', 'drafts.json');
    try {
      const address = formData.data.Info['Property Address'];
      if (!address) {
        throw new Error('Property Address is missing, cannot save draft.');
      }

      const placeId = await getPlaceId(address);
      const now = new Date().toISOString();

      let drafts = [];
      try {
        const jsonString = await fs.readFile(filePath, 'utf-8');
        drafts = DraftsFileSchema.parse(JSON.parse(jsonString));
      } catch (e: any) {
        if (e.code !== 'ENOENT') throw e; // Re-throw if it's not a "file not found" error
        // File doesn't exist, we'll create it with the new draft.
      }
      
      const existingDraftIndex = drafts.findIndex(d => d.placeId === placeId);

      if (existingDraftIndex !== -1) {
        // Update existing draft
        const existingDraft = drafts[existingDraftIndex];
        drafts[existingDraftIndex] = {
            ...existingDraft,
            propertyAddress: address, // Update address in case it was slightly different
            updatedAt: now,
            formData,
        };
      } else {
        // Add new draft
        const newDraft = {
            draftId: crypto.randomUUID(),
            propertyAddress: address,
            placeId,
            createdAt: now,
            updatedAt: now,
            formData,
        };
        DraftSchema.parse(newDraft); // Validate the new draft object
        drafts.push(newDraft);
      }
      
      const contentJsonString = JSON.stringify(drafts, null, 2);
      await fs.writeFile(filePath, contentJsonString, 'utf-8');

    } catch (error: any) {
      console.error('Failed to save draft:', error);
      throw new Error(`Failed to write to drafts.json: ${error.message}`);
    }
  }
);
