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
import { saveJsonStructure } from '@/ai/flows/save-json-structure';
import { extractPropertyData } from '@/ai/flows/extract-property-data-from-pdf';
import initialJsonStructure from '@/lib/json-structure.json';

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
};

// Convert initial JSON object to a nicely formatted string
const defaultJsonString = JSON.stringify(initialJsonStructure, null, 2);

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

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function JsonEditorPage() {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [testResult, setTestResult] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jsonStructure: defaultJsonString,
      testPropertyTitlePdf: [],
      testBriefInformationPdf: [],
    },
  });

  async function onTestRun(values: z.infer<typeof formSchema>) {
    setIsTesting(true);
    setTestResult(null);
    try {
        if (!values.testPropertyTitlePdf?.[0] || !values.testBriefInformationPdf?.[0]) {
            throw new Error('PDF files are missing for the test.');
        }

        const [propertyTitlePdfDataUri, briefInformationPdfDataUri] = await Promise.all([
            fileToDataUri(values.testPropertyTitlePdf[0]),
            fileToDataUri(values.testBriefInformationPdf[0]),
        ]);

        const result = await extractPropertyData({
            propertyTitlePdfDataUri,
            briefInformationPdfDataUri,
        });

        setTestResult(JSON.stringify(result, null, 2));
        toast({
            title: 'Test Complete',
            description: 'AI extraction test finished using the current JSON structure.',
        });
    } catch (error: any) {
        console.error('Test run failed:', error);
        setTestResult(`Error: ${error.message}`);
        toast({
            variant: 'destructive',
            title: 'Test Failed',
            description: 'Could not run the AI extraction test.',
        });
    } finally {
        setIsTesting(false);
    }
  }

  async function onSave(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    try {
        await saveJsonStructure({ jsonStructure: values.jsonStructure });
        toast({ title: 'JSON Structure Saved', description: 'The AI will now use this new structure for data extraction.' });
    } catch (error: any) {
        console.error('Failed to save:', error);
        toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">JSON Editor & Tester</h1>
        <p className="text-muted-foreground">
          Edit and test the JSON structure for AI data extraction. Your saved changes will be used globally.
        </p>
      </header>
      <main>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onTestRun)}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>AI Extraction Rules</CardTitle>
                  <CardDescription>Define the JSON output structure for the AI. Click "Save" to apply changes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="jsonStructure"
                    render={({ field }) => (
                      <Textarea {...field} className="min-h-[400px] font-mono text-xs" />
                    )}
                  />
                   <div className="flex justify-end">
                    <Button type="button" variant="secondary" onClick={() => onSave(form.getValues())} disabled={isSaving}>
                      {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : 'Save JSON'}
                    </Button>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Test Files</CardTitle>
                       <CardDescription>Upload files to test the extraction rules defined above.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="testPropertyTitlePdf" render={() => (<Controller name="testPropertyTitlePdf" control={form.control} render={({field}) => (<FileUploader label="Test Property Title (PDF)" value={field.value} onValueChange={field.onChange} options={{ accept: ACCEPTED_FILE_TYPES }} maxFiles={1} />)} />)} />
                      <FormField control={form.control} name="testBriefInformationPdf" render={() => (<Controller name="testBriefInformationPdf" control={form.control} render={({field}) => (<FileUploader label="Test Brief Information (PDF)" value={field.value} onValueChange={field.onChange} options={{ accept: ACCEPTED_FILE_TYPES }} maxFiles={1} />)} />)} />
                    </CardContent>
                  </Card>
                  <div className="flex justify-start">
                     <Button type="submit" disabled={isTesting}>
                      {isTesting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...</>) : 'Run Test'}
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
