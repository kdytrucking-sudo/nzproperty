import { z } from 'zod';

export const AIConfigSchema = z.object({
  model: z.string().default('googleai/gemini-1.5-pro'),
  temperature: z.coerce.number().min(0).max(1).default(0.5),
  topP: z.coerce.number().min(0).max(1).default(1),
  topK: z.coerce.number().min(0).default(32),
  maxOutputTokens: z.coerce.number().min(1).default(8192),
});

export type AIConfig = z.infer<typeof AIConfigSchema>;
