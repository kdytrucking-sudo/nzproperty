
import { z } from 'zod';

export const CommentaryOptionItemSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  label: z.string(),
  option: z.string(),
});

export const CommentaryCardSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  cardName: z.string().min(1, 'Card name is required.'),
  placeholder: z.string().min(1, 'Placeholder is required.'),
  options: z.array(CommentaryOptionItemSchema),
});

export const CommentaryCardsSchema = z.array(CommentaryCardSchema);

export type CommentaryOptionItem = z.infer<typeof CommentaryOptionItemSchema>;
export type CommentaryCard = z.infer<typeof CommentaryCardSchema>;
export type CommentaryCardsData = z.infer<typeof CommentaryCardsSchema>;

    
