import { z } from 'zod';

export const CommentaryOptionsSchema = z.object({
  PreviousSale: z.array(z.string()),
  ContractSale: z.array(z.string()),
  Disclosure: z.array(z.string()),
  MarketComment: z.array(z.string()),
});

export type CommentaryOptionsData = z.infer<typeof CommentaryOptionsSchema>;
