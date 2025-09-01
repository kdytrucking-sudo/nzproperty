import { config } from 'dotenv';
config();

import '@/ai/flows/update-valuation-summary.ts';
import '@/ai/flows/extract-property-data-from-pdf.ts';
import '@/ai/flows/generate-report-from-template.ts';
