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

const ExtractPropertyDataOutputSchema = z.object({
  propertyDetails: z.object({
    address: z.string().describe('The address of the property.'),
    legalDescription: z.string().describe('The legal description of the property.'),
    ownerName: z.string().describe('The name of the property owner.'),
    landArea: z.string().describe('The land area of the property.'),
    floorArea: z.string().describe('The floor area of the property.'),
    currentCV: z.string().describe('The current capital value of the property.'),
    lastSaleDate: z.string().describe('The date of the last sale of the property.'),
    lastSalePrice: z.string().describe('The price of the last sale of the property.'),
    zoning: z.string().describe('The zoning of the property.'),
    propertyType: z.string().describe('The type of property.'),
  }),
  valuationSummary: z.object({
    valuationDate: z.string().describe('The date of the valuation.'),
    marketValue: z.string().describe('The market value of the property.'),
    methodologyUsed: z.string().describe('The methodology used for the valuation.'),
    keyAssumptions: z.string().describe('The key assumptions made during the valuation.'),
  }),
  comparableSales: z
    .array(
      z.object({
        compAddress: z.string().describe('The address of the comparable property.'),
        compSaleDate: z.string().describe('The sale date of the comparable property.'),
        compSalePrice: z.string().describe('The sale price of the comparable property.'),
        compLandArea: z.string().describe('The land area of the comparable property.'),
        compFloorArea: z.string().describe('The floor area of the comparable property.'),
      })
    )
    .describe('Comparable sales data.'),
  risksAndOpportunities: z.string().describe('Risks and opportunities associated with the property.'),
  additionalNotes: z.string().describe('Additional notes about the property.'),
});
export type ExtractPropertyDataOutput = z.infer<typeof ExtractPropertyDataOutputSchema>;

export async function extractPropertyData(input: ExtractPropertyDataInput): Promise<ExtractPropertyDataOutput> {
  return extractPropertyDataFlow(input);
}

const extractTextFromPdfTool = ai.defineTool(
    {
      name: 'extractTextFromPdf',
      description: 'Extracts text from a PDF file provided as a data URI.',
      inputSchema: z.object({
        dataUri: z.string().describe("The PDF file's data URI."),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      // TODO: Actually implement PDF extraction using Google Cloud Vision API
      // For now, just return a placeholder
      return `Extracted text from PDF with data URI: ${input.dataUri}`;
    },
);

const prompt = ai.definePrompt({
  name: 'extractPropertyDataPrompt',
  input: {schema: z.object({
    propertyTitleText: z.string(),
    briefInformationText: z.string(),
  })},
  output: {schema: ExtractPropertyDataOutputSchema},
  prompt: `你是一个在新西兰房产行业工作的资深数据分析师。你的任务是分析并从两份提供的 PDF 文件中提取关键数据。你需要理解新西兰房产估价报告的常见结构和术语，如 'Capital Value (CV)'、'Legal Description' 等。请严格按照用户提供的 JSON 格式输出所有信息，如果某个信息在文档中找不到，请在JSON中用“N/A”来代替。\n\n请仔细阅读以下两份 PDF 文档的文本内容，并根据你的专业知识和我的提取指令，提取所有必要信息。第一份文件是房产产权文件（Property Title），第二份是房产简要信息文件（Brief Information）。\n\n---\n\n**提取指令和提示:**
1.  **从房产产权文件 (Property Title) 中提取：**
    * **法律描述 (legalDescription):** 寻找 'Legal Description' 或 'Title' 部分。
    * **业主姓名 (ownerName):** 寻找 'Proprietor' 或 'Registered Owner'。
    * **土地面积 (landArea):** 寻找 'Area' 或 'Land Size'，通常以平方米 (m²) 或公顷 (ha) 为单位。
\n2.  **从房产简要信息文件 (Brief Information) 中提取：**
    * **房产地址 (address):** 通常位于报告首页顶部。
    * **政府估价 (currentCV):** 寻找 'Capital Value (CV)' 或 'Rating Valuation'。
    * **最后成交日期和价格 (lastSaleDate & lastSalePrice):** 寻找 'Sale History' 或 'Last Sale' 等表格。
\n3.  **其他信息：**
    * 根据文档内容，提取所有你认为重要的补充信息，比如房产类型、卧室数量、车库数量等。
\n---\n\n**输出JSON格式:**
{
  "propertyDetails": {
    "address": "[extracted_address]",
    "legalDescription": "[extracted_legal_description]",
    "ownerName": "[extracted_owner_name]",
    "landArea": "[extracted_land_area]",
    "floorArea": "[extracted_floor_area]",
    "currentCV": "[extracted_current_CV]",
    "lastSaleDate": "[extracted_last_sale_date]",
    "lastSalePrice": "[extracted_last_sale_price]",
    "zoning": "[extracted_zoning]",
    "propertyType": "[extracted_property_type]"
  },
  "valuationSummary": {
    "valuationDate": "[extracted_valuation_date]",
    "marketValue": "[extracted_market_value]",
    "methodologyUsed": "[extracted_methodology]",
    "keyAssumptions": "[extracted_key_assumptions]"
  },
  "comparableSales": [
    {
      "compAddress": "[extracted_comp_address_1]",
      "compSaleDate": "[extracted_comp_sale_date_1]",
      "compSalePrice": "[extracted_comp_sale_price_1]",
      "compLandArea": "[extracted_comp_land_area_1]",
      "compFloorArea": "[extracted_comp_floor_area_1]"
    }
  ],
  "risksAndOpportunities": "[extracted_risks_and_opportunities]",
  "additionalNotes": "[extracted_additional_notes]"
}
\n---\n\n**PDF文档内容 (文本形式):**
\n**文件 1 (Property Title):**
{{{propertyTitleText}}}
\n\n**文件 2 (Brief Information):**
{{{briefInformationText}}}
`,
});

const extractPropertyDataFlow = ai.defineFlow(
  {
    name: 'extractPropertyDataFlow',
    inputSchema: ExtractPropertyDataInputSchema,
    outputSchema: ExtractPropertyDataOutputSchema,
  },
  async input => {
    const propertyTitleText = await extractTextFromPdfTool({ dataUri: input.propertyTitlePdfDataUri });
    const briefInformationText = await extractTextFromPdfTool({ dataUri: input.briefInformationPdfDataUri });

    const {output} = await prompt({
        propertyTitleText,
        briefInformationText,
    });
    return output!;
  }
);
