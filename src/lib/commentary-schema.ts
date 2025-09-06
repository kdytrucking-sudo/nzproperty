import { z } from 'zod';

export const CommentaryOptionsSchema = z.object({
  PurposeofValuation: z.array(z.string()),
  PrincipalUse: z.array(z.string()),
  PreviousSale: z.array(z.string()),
  ContractSale: z.array(z.string()),
  SuppliedDocumentation: z.array(z.string()),
  RecentOrProvided: z.array(z.string()),
  LIM: z.array(z.string()),
  PC78: z.array(z.string()),
  OperativeZone: z.array(z.string()),
});

export type CommentaryOptionsData = z.infer<typeof CommentaryOptionsSchema>;
