'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormField } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import { FileUploader } from '@/components/file-uploader';
import { Textarea } from '@/components/ui/textarea';

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
};

const defaultJsonStructure = `{
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
}`;

const formSchema = z.object({
  jsonStructure: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, { message: 'Invalid JSON format.' }),
  testPropertyTitlePdf: z.array(z.instanceof(File)).min(1, 'Property Title PDF is required for testing.'),
  testBriefInformationPdf: z.array(z.instanceof(File)).min(1, 'Brief Information PDF is required for testing.'),
});

export default function JsonEditorPage() {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [testResult, setTestResult] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jsonStructure: defaultJsonStructure,
      testPropertyTitlePdf: [],
      testBriefInformationPdf: [],
    },
  });

  async function onTestRun(values: z.infer<typeof formSchema>) {
    setIsTesting(true);
    setTestResult(null);
    console.log('Running test with JSON:', values.jsonStructure);

    // Simulate AI extraction test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // This is mock data. In a real scenario, this would be the output from the AI.
    const mockResult = {
      ...JSON.parse(values.jsonStructure),
      propertyDetails: {
        address: "123 Test Street, Auckland",
        ownerName: "John Doe",
      }
    };
    
    setTestResult(JSON.stringify(mockResult, null, 2));
    toast({
      title: 'Test Complete',
      description: 'AI extraction test finished. Check the results.',
    });
    setIsTesting(false);
  }

  async function onSave() {
    setIsSaving(true);
    // Simulate saving to database
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({ title: 'JSON Structure Saved' });
    setIsSaving(false);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">JSON Editor & Tester</h1>
        <p className="text-muted-foreground">
          Edit and test the JSON structure for AI data extraction.
        </p>
      </header>
      <main>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onTestRun)}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>AI Extraction Rules</CardTitle>
                  <CardDescription>Define the JSON output structure for the AI.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="jsonStructure"
                    render={({ field }) => (
                      <Textarea {...field} className="min-h-[400px] font-mono text-xs" />
                    )}
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle>Test Files</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="testPropertyTitlePdf" render={() => (<Controller name="testPropertyTitlePdf" control={form.control} render={({field}) => (<FileUploader label="Test Property Title (PDF)" value={field.value} onValueChange={field.onChange} options={{ accept: ACCEPTED_FILE_TYPES }} maxFiles={1} />)} />)} />
                      <FormField control={form.control} name="testBriefInformationPdf" render={() => (<Controller name="testBriefInformationPdf" control={form.control} render={({field}) => (<FileUploader label="Test Brief Information (PDF)" value={field.value} onValueChange={field.onChange} options={{ accept: ACCEPTED_FILE_TYPES }} maxFiles={1} />)} />)} />
                    </CardContent>
                  </Card>
                  <div className="flex justify-between">
                     <Button type="submit" disabled={isTesting}>
                      {isTesting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...</>) : 'Run Test'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={onSave} disabled={isSaving}>
                      {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : 'Save JSON'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Test Result</CardTitle>
                  <CardDescription>The extracted JSON data will appear here.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isTesting ? (
                    <div className="flex h-full min-h-[400px] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <pre className="w-full min-h-[400px] rounded-md bg-muted p-4 text-xs text-muted-foreground overflow-auto">
                      {testResult || 'Run a test to see results...'}
                    </pre>
                  )}
                </CardContent>
              </Card>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
