
import { z } from 'zod';

export const MultiOptionItemSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  label: z.string(),
  option: z.string(),
});

export const MultiOptionCardSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  cardName: z.string().min(1, 'Card name is required.'),
  placeholder: z.string().min(1, 'Placeholder is required.'),
  options: z.array(MultiOptionItemSchema),
});

export const MultiOptionsSchema = z.array(MultiOptionCardSchema);

export type MultiOptionItem = z.infer<typeof MultiOptionItemSchema>;
export type MultiOptionCard = z.infer<typeof MultiOptionCardSchema>;
export type MultiOptionsData = z.infer<typeof MultiOptionsSchema>;
