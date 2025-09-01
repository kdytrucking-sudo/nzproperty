'use server';
/**
 * @fileOverview Extracts property data from uploaded PDFs using Gemini API and Google Cloud Vision API for OCR.
 *
 * - extractPropertyData - A function that handles the extraction of property data from PDFs.
 * - ExtractPropertyDataInput - The input type for the extractPropertyData function.
 * - ExtractPropertyDataOutput - The return type for the extractPropertyData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import fs from 'fs/promises';
import path from 'path';

// Dynamically create the Zod schema from the JSON file
async function getOutputSchema() {
    const filePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
    const jsonString = await fs.readFile(filePath, 'utf-8');
    const jsonObject = JSON.parse(jsonString);

    function createZodSchema(obj: any): z.ZodType<any> {
        if (Array.isArray(obj)) {
            if (obj.length > 0) {
                return z.array(createZodSchema(obj[0]));
            } else {
                return z.array(z.any());
            }
        } else if (typeof obj === 'object' && obj !== null) {
            const shape: { [key: string]: z.ZodType<any> } = {};
            for (const key in obj) {
                shape[key] = createZodSchema(obj[key]);
            }
            return z.object(shape);
        } else if (typeof obj === 'string') {
            // All fields are treated as strings as per the placeholder format.
            return z.string().describe(`Extracted data for ${obj.replace(/\[|\]/g, '')}`);
        }
        return z.any();
    }
    return createZodSchema(jsonObject);
}

// Define input schema statically
const ExtractPropertyDataInputSchema = z.object({
  propertyTitlePdfDataUri: z
    .string()
    .describe(
      "A PDF file containing property title information, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  briefInformationPdfDataUri: z
    .string()
    .describe(
      "A PDF file containing brief property information, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractPropertyDataInput = z.infer<typeof ExtractPropertyDataInputSchema>;

// The output type will be dynamic based on the schema
export type ExtractPropertyDataOutput = z.infer<Awaited<ReturnType<typeof getOutputSchema>>>;

// Exported function to be used by the client
export async function extractPropertyData(input: ExtractPropertyDataInput): Promise<ExtractPropertyDataOutput> {
  const outputSchema = await getOutputSchema();
  const extractPropertyDataFlow = ai.defineFlow(
    {
      name: 'extractPropertyDataFlow',
      inputSchema: ExtractPropertyDataInputSchema,
      outputSchema: outputSchema,
    },
    async (flowInput) => {
        const filePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
        const jsonFormat = await fs.readFile(filePath, 'utf-8');

        // TODO: Actually implement PDF extraction. For now, we are returning mock data based on the schema.
        // This is a placeholder for actual PDF text extraction logic.
        const propertyTitleText = "Mock extracted text from property title PDF.";
        const briefInformationText = "Mock extracted text from brief info PDF.";

        const prompt = ai.definePrompt({
            name: 'extractPropertyDataPrompt',
            input: {schema: z.object({
                propertyTitleText: z.string(),
                briefInformationText: z.string(),
            })},
            output: {schema: outputSchema},
            prompt: `You are an expert data analyst in the New Zealand property sector. Your task is to analyze and extract key data from two provided PDF documents. You must understand common New Zealand property valuation report structures and terminology, such as 'Capital Value (CV)', 'Legal Description', etc. Strictly output all information in the JSON format provided by the user. If a piece of information cannot be found in the document, use "N/A" in the JSON field.

Please carefully read the text content of the following two PDF documents and extract all necessary information based on your expertise and my extraction instructions. The first document is the Property Title, and the second is the Brief Information.

---

**Extraction Instructions and Hints:**
1.  **From Property Title Document:**
    *   **legalDescription:** Look for 'Legal Description' or 'Title' section.
    *   **ownerName:** Look for 'Proprietor' or 'Registered Owner'.
    *   **landArea:** Look for 'Area' or 'Land Size', usually in square meters (m²) or hectares (ha).
2.  **From Brief Information Document:**
    *   **address:** Usually located at the top of the first page.
    *   **currentCV:** Look for 'Capital Value (CV)' or 'Rating Valuation'.
    *   **lastSaleDate & lastSalePrice:** Look for 'Sale History' or 'Last Sale' tables.
3.  **Other Information:**
    *   Extract any other important supplementary information you find, such as property type, number of bedrooms, garages, etc.

---

**Output JSON Format:**
\`\`\`json
${jsonFormat}
\`\`\`

---

**PDF Document Content (Text Form):**

**File 1 (Property Title):**
{{{propertyTitleText}}}

**File 2 (Brief Information):**
{{{briefInformationText}}}
`,
        });

        const { output } = await prompt({
            propertyTitleText,
            briefInformationText,
        });

        return output!;
    }
  );

  return extractPropertyDataFlow(input);
}
