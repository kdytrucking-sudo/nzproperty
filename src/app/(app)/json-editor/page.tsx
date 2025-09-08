'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, TestTube2, ShieldX } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import { FileUploader } from '@/components/file-uploader';
import { Textarea } from '@/components/ui/textarea';
import { saveExtractionConfig } from '@/ai/flows/save-json-structure';
import { extractPropertyData } from '@/ai/flows/extract-property-data-from-pdf';
import { getExtractionConfig } from '@/ai/flows/get-extraction-config';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
};

const formSchema = z.object({
  jsonStructure: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, { message: 'Invalid JSON format.' }),
  systemPrompt: z.string().min(1, 'System prompt is required.'),
  userPrompt: z.string().min(1, 'User prompt is required.'),
  extractionHintsTitle: z.string().min(1, 'Extraction hints title is required.'),
  extractionHints: z.string().min(1, 'Extraction hints are required.'),
  testPropertyTitlePdf: z.array(z.instanceof(File)).min(1, 'Property Title PDF is required for testing.'),
  testBriefInformationPdf: z.array(z.instanceof(File)).min(1, 'Brief Information PDF is required for testing.'),
});

type FormValues = z.infer<typeof formSchema>;

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
  const [isLoading, setIsLoading] = React.useState(true);
  const [testResult, setTestResult] = React.useState<string | null>(null);
  const [initialData, setInitialData] = React.useState<FormValues | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const { formState: { isDirty } } = form;
  
  React.useEffect(() => {
    async function loadConfig() {
      setIsLoading(true);
      try {
        const config = await getExtractionConfig();
        const initialFormValues = {
          ...config,
          testPropertyTitlePdf: [],
          testBriefInformationPdf: [],
        };
        form.reset(initialFormValues);
        setInitialData(initialFormValues);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Failed to load configuration',
          description: error.message,
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, [form, toast]);


  async function onTestRun(values: FormValues) {
    setIsTesting(true);
    setTestResult(null);
    try {
        if (!values.testPropertyTitlePdf?.[0] || !values.testBriefInformationPdf?.[0]) {
            throw new Error('PDF files are missing for the test.');
        }

        // Run test with current form data, no need to save first
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
            description: 'AI extraction test finished using the current JSON structure and prompts.',
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

  async function onSave(values: FormValues) {
    setIsSaving(true);
    try {
      await saveExtractionConfig(values);
      form.reset(values); // This resets the 'dirty' state
      setInitialData(values); // Update initial data to prevent revert issues
      toast({
        title: 'Configuration Saved',
        description: 'The AI will now use the new structure and prompts.',
      });
    } catch (error: any) {
      console.error('Failed to save:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleRevert() {
      if(initialData) {
          form.reset(initialData);
          toast({
              title: 'Changes Reverted',
              description: 'Your changes have been discarded.'
          });
      }
  }
  
  if (isLoading) {
      return (
          <div className="space-y-8">
              <Skeleton className="h-12 w-1/2" />
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  <div className="space-y-6">
                      <Skeleton className="h-96 w-full" />
                      <Skeleton className="h-96 w-full" />
                  </div>
                   <div className="space-y-6">
                      <Skeleton className="h-96 w-full" />
                  </div>
              </div>
          </div>
      )
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">AI Extraction Rules</h1>
        <p className="text-muted-foreground">
          Edit and test the JSON structure and prompts that the AI uses to extract data from documents. Your saved changes will be used globally.
        </p>
      </header>
      <main>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onTestRun)}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-6 xl:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>AI Prompts</CardTitle>
                        <CardDescription>Define the instructions for the AI extractor.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                         <FormField control={form.control} name="systemPrompt" render={({ field }) => ( <FormItem> <FormLabel>System Prompt (AI's Role)</FormLabel> <Textarea {...field} className="min-h-[100px] font-mono text-xs" /> </FormItem> )} />
                         <FormField control={form.control} name="userPrompt" render={({ field }) => ( <FormItem> <FormLabel>User Prompt (Main Task)</FormLabel> <Textarea {...field} className="min-h-[150px] font-mono text-xs" /> </FormItem> )} />
                         <FormField control={form.control} name="extractionHintsTitle" render={({ field }) => ( <FormItem> <FormLabel>Extraction Hints Title</FormLabel> <Input {...field} className="font-mono text-xs" /> </FormItem> )} />
                         <FormField control={form.control} name="extractionHints" render={({ field }) => ( <FormItem> <FormLabel>Extraction Hints (Detailed Instructions)</FormLabel> <Textarea {...field} className="min-h-[200px] font-mono text-xs" /> </FormItem> )} />
                      </CardContent>
                    </Card>
                     <Card>
                      <CardHeader>
                        <CardTitle>AI Output Structure (JSON)</CardTitle>
                        <CardDescription>Define the JSON output format for the AI.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <FormField control={form.control} name="jsonStructure" render={({ field }) => ( <Textarea {...field} className="min-h-[580px] font-mono text-xs" /> )} />
                      </CardContent>
                    </Card>
                </div>
              </div>
              <div className="space-y-6">
                <Card>
                    <CardHeader>
                      <CardTitle>Test Center</CardTitle>
                       <CardDescription>Upload files to test the extraction rules and prompts defined on the left. This does not use your saved settings until you click "Save Changes".</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="testPropertyTitlePdf" render={() => (<Controller name="testPropertyTitlePdf" control={form.control} render={({field}) => (<FileUploader label="Test Property Title (PDF)" value={field.value} onValueChange={field.onChange} options={{ accept: ACCEPTED_FILE_TYPES }} maxFiles={1} />)} />)} />
                      <FormField control={form.control} name="testBriefInformationPdf" render={() => (<Controller name="testBriefInformationPdf" control={form.control} render={({field}) => (<FileUploader label="Test Brief Information (PDF)" value={field.value} onValueChange={field.onChange} options={{ accept: ACCEPTED_FILE_TYPES }} maxFiles={1} />)} />)} />
                       <div className="flex justify-start pt-4">
                         <Button type="submit" disabled={isTesting}>
                          {isTesting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...</>) : <><TestTube2 className="mr-2 h-4 w-4" /> Run Test</>}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Test Result</CardTitle>
                    <CardDescription>The extracted JSON data from the test run will appear here.</CardDescription>
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
            </div>
             {isDirty && (
                 <div className="fixed bottom-6 right-6 z-50 w-full max-w-md">
                     <Alert variant="destructive" className="bg-destructive/95 text-destructive-foreground shadow-lg backdrop-blur-sm">
                        <AlertTitle className="font-bold">You have unsaved changes!</AlertTitle>
                        <AlertDescription className="text-destructive-foreground/90">
                           Save your changes to make them available across the app.
                        </AlertDescription>
                        <div className="mt-4 flex gap-x-2 justify-end">
                            <Button type="button" variant="outline" size="sm" onClick={handleRevert} className="bg-transparent border-destructive-foreground/50 text-destructive-foreground hover:bg-destructive-foreground/10 hover:text-destructive-foreground">
                                <ShieldX className="mr-2 h-4 w-4"/> Revert
                            </Button>
                            <Button type="button" variant="secondary" size="sm" disabled={isSaving} className="bg-destructive-foreground text-destructive hover:bg-destructive-foreground/90" onClick={() => onSave(form.getValues())}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                                Save Changes
                            </Button>
                        </div>
                    </Alert>
                </div>
            )}
          </form>
        </Form>
      </main>
    </div>
  );
}
