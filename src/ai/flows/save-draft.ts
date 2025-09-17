'use server';
/**
 * @fileOverview Saves or updates a draft to drafts.json in Firebase Storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { DraftSchema, DraftsFileSchema } from '@/lib/drafts-schema';
import * as crypto from 'crypto';
import { writeJSON, readJSON } from '@/lib/storage'; // Firebase Storage 封装

const ai = await getAi();

const SaveDraftInputSchema = z.object({
  formData: z.any(),
});

const SaveDraftOutputSchema = z.object({
  draftId: z.string(),
});

export async function saveDraft(input: { formData: any }): Promise<{ draftId: string }> {
  return saveDraftFlow(input);
}

// 获取 place_id
async function getPlaceId(address: string): Promise<string> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not configured.');

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Geocoding API request failed with status ${response.status}: ${errorBody}`);
    }
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) return data.results[0].place_id;

    if (data.status === 'ZERO_RESULTS') {
      return `fallback_${crypto
        .createHash('md5')
        .update(address.toLowerCase().trim())
        .digest('hex')}`;
    }

    throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || 'No results'}`);
  } catch (fetchError: any) {
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
    const storagePath = 'json/drafts.json'; // Firebase Storage 文件路径
    let draftId: string;

    try {
      const address = formData.data?.Info?.['Property Address'];
      if (!address) throw new Error('Property Address is missing, cannot save draft.');

      const placeId = await getPlaceId(address);
      const now = new Date().toISOString();

      let drafts: any[] = [];
      try {
        const existingDrafts = await readJSON(storagePath);
        drafts = DraftsFileSchema.parse(existingDrafts);
      } catch {
        // 文件不存在或解析失败 -> 初始化
        drafts = [];
        await writeJSON(storagePath, drafts);
      }

      const existingDraftIndex = drafts.findIndex((d) => d.placeId === placeId);

      if (existingDraftIndex !== -1) {
        // 更新已有 draft
        const existingDraft = drafts[existingDraftIndex];
        const mergedFormData = {
          ...existingDraft.formData,
          ...formData,
          data: {
            ...existingDraft.formData?.data,
            ...formData.data,
          },
          uploadedImages: {
            ...(existingDraft.formData?.uploadedImages || {}),
            ...(formData.uploadedImages || {}),
          },
        };

        drafts[existingDraftIndex] = DraftSchema.parse({
          ...existingDraft,
          formData: mergedFormData,
          propertyAddress: address,
          updatedAt: now,
        });
        draftId = existingDraft.draftId;
      } else {
        // 新增 draft
        const newDraftId = crypto.randomUUID();
        const newDraft = {
          draftId: newDraftId,
          placeId,
          propertyAddress: address,
          createdAt: now,
          updatedAt: now,
          formData,
        };
        DraftSchema.parse(newDraft);
        drafts.push(newDraft);
        draftId = newDraftId;
      }

      // 写入 Firebase Storage
      await writeJSON(storagePath, drafts);

      return { draftId };
    } catch (error: any) {
      console.error('Failed to save draft:', error);
      throw new Error(`Failed to write to drafts.json: ${error.message}`);
    }
  }
);
