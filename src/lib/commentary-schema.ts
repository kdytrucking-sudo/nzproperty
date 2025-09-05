import { z } from 'zod';

export const CommentaryOptionsSchema = z.object({
  PreviousSale: z.array(z.string()),
  ContractSale: z.array(z.string()),
  Disclosure: z.array(z.string()),
  MarketComment: z.array(z.string()),
  SuppliedDocumentation: z.array(z.string()),
  RecentOrProvided: z.array(z.string()),
  LIM: z.array(z.string()),
  PC78: z.array(z.string()),
  OperativeZone: z.array(z.string()),
  ZoningOperative: z.array(z.string()),
  ZoningPlanChange78: z.array(z.string()),
});

export type CommentaryOptionsData = z.infer<typeof CommentaryOptionsSchema>;
