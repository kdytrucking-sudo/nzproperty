import { z } from 'zod';

export const AiConfigSchema = z.object({
  model: z.string().min(1, "Model name is required."),
  temperature: z.coerce.number().min(0).max(2).optional(),
  topP: z.coerce.number().min(0).max(1).optional(),
  topK: z.coerce.number().int().min(1).optional(),
  maxOutputTokens: z.coerce.number().int().min(1).optional(),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;

export const DEFAULT_AI_CONFIG: AiConfig = {
    model: 'googleai/gemini-2.5-pro',
    temperature: 0.2,
    topP: 1,
    topK: 1,
    maxOutputTokens: 8192,
};
