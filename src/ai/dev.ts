import { config } from 'dotenv';
config();

import '@/ai/flows/update-valuation-summary.ts';
import '@/ai/flows/extract-property-data-from-pdf.ts';
import '@/ai/flows/generate-report-from-template.ts';
import '@/ai/flows/save-json-structure.ts';
import '@/ai/flows/save-global-content.ts';
import '@/ai/flows/list-templates.ts';
import '@/ai/flows/upload-template.ts';
import '@/ai/flows/delete-template.ts';
