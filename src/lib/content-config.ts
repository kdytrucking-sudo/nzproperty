import { z } from 'zod';

const formSchema = z.object({
  nzEconomicOverview: z.string(),
  globalEconomicOverview: z.string(),
  residentialMarket: z.string(),
  recentMarketDirection: z.string(),
  marketVolatility: z.string(),
  localEconomyImpact: z.string(),
});

type ContentFormData = z.infer<typeof formSchema>;

export const contentFields: { name: keyof ContentFormData; label: string, placeholder: string, templateKey: string }[] = [
    { name: "nzEconomicOverview", label: "New Zealand Economy Overview", placeholder: "Enter New Zealand Economy Overview...", templateKey: "Replace_NZEconomic" },
    { name: "globalEconomicOverview", label: "Global Economic Overview", placeholder: "Enter Global Economic Overview...", templateKey: "Replace_GlobalEconomic" },
    { name: "residentialMarket", label: "Residential Market", placeholder: "Enter Residential Market details...", templateKey: "Replace_ResidentialMarket" },
    { name: "recentMarketDirection", label: "Recent Market Direction", placeholder: "Enter Recent Market Direction...", templateKey: "Replace_RecentMarketDirection" },
    { name: "marketVolatility", label: "Market Volatility", placeholder: "Enter Market Volatility information...", templateKey: "Replace_MarketVolatility" },
    { name: "localEconomyImpact", label: "Local Economy Impact", placeholder: "Enter Local Economy Impact analysis...", templateKey: "Replace_LocalEconomyImpact" },
] as const;

export { type ContentFormData, formSchema as contentFormSchema };
