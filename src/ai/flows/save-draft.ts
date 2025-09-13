'use server';
/**
 * @fileOverview Saves or updates a draft to the drafts.json file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { DraftSchema, DraftsFileSchema } from '@/lib/drafts-schema';
import * as crypto from 'crypto';

const SaveDraftInputSchema = z.object({
  formData: z.any(),
});

const SaveDraftOutputSchema = z.object({
  draftId: z.string(),
});

export async function saveDraft(input: { formData: any }): Promise<{ draftId: string }> {
  return saveDraftFlow(input);
}

// Helper to get place_id from Google Maps Geocoding API
async function getPlaceId(address: string): Promise<string> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured on the server.');
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Geocoding API request failed with status ${response.status}: ${errorBody}`);
        }
        const data = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
        return data.results[0].place_id;
        }
        
        if (data.status === 'ZERO_RESULTS') {
        // If Google can't find it, we'll use a hash of the address as a fallback.
        // This is not ideal but better than nothing for uniqueness.
        return `fallback_${crypto.createHash('md5').update(address.toLowerCase().trim()).digest('hex')}`;
        }

        throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || 'No results'}`);
    } catch(fetchError: any) {
        throw new Error(`Failed to call Geocoding API: ${fetchError.message}`);
    }

}

const saveDraftFlow = ai.defineFlow(
  {
    name: 'saveDraftFlow',
    inputSchema: SaveDraftInputSchema,
    outputSchema: SaveDraftOutputSchema,
  },
  async ({ formData }) => {
    const filePath = path.join(process.cwd(), 'src/lib', 'drafts.json');
    let draftId: string;
    try {
      const address = formData.data?.Info?.['Property Address'];
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
        await fs.writeFile(filePath, '[]', 'utf-8');
      }
      
      const existingDraftIndex = drafts.findIndex(d => d.placeId === placeId);

      if (existingDraftIndex !== -1) {
        // Update existing draft
        const existingDraft = drafts[existingDraftIndex];
        drafts[existingDraftIndex] = DraftSchema.parse({
            ...existingDraft,
            formData: {
              // Deep merge formData to preserve existing data
              ...existingDraft.formData,
              ...formData,
              data: {
                ...existingDraft.formData?.data,
                ...formData.data,
              }
            },
            propertyAddress: address, // Update address in case it was slightly different
            updatedAt: now,
        });
        draftId = existingDraft.draftId;
      } else {
        // Add new draft
        const newDraftId = crypto.randomUUID();
        const newDraft = {
            draftId: newDraftId,
            placeId,
            propertyAddress: address,
            createdAt: now,
            updatedAt: now,
            formData,
        };
        DraftSchema.parse(newDraft); // Validate the new draft object
        drafts.push(newDraft);
        draftId = newDraftId;
      }
      
      const contentJsonString = JSON.stringify(drafts, null, 2);
      await fs.writeFile(filePath, contentJsonString, 'utf-8');

      return { draftId };

    } catch (error: any) {
      console.error('Failed to save draft:', error);
      throw new Error(`Failed to write to drafts.json: ${error.message}`);
    }
  }
);
