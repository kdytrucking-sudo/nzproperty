
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
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
import { getExtractionConfig } from '@/ai/flows/get-extraction-config';
import { extractPropertyData } from '@/ai/flows/extract-property-data-from-pdf';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { getAiConfig } from '@/ai/flows/get-ai-config';
import { saveAiConfig } from '@/ai/flows/save-ai-config';
import { type AiConfig, AiConfigSchema, DEFAULT_AI_CONFIG } from '@/lib/ai-config-schema';

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
  testPropertyTitlePdf: z.array(z.instanceof(File)).optional(),
  testBriefInformationPdf: z.array(z.instanceof(File)).optional(),
  aiConfig: AiConfigSchema,
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
  const [isSavingAiSettings, setIsSavingAiSettings] = React.useState(false);
  const [testResult, setTestResult] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: async () => {
        try {
            const [extractionConfig, aiConfig] = await Promise.all([
                getExtractionConfig(),
                getAiConfig()
            ]);
            return {
                ...extractionConfig,
                testPropertyTitlePdf: [],
                testBriefInformationPdf: [],
                aiConfig: aiConfig || DEFAULT_AI_CONFIG,
            };
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to load initial config', description: error.message });
            return {
                jsonStructure: "{}",
                systemPrompt: "",
                userPrompt: "",
                extractionHintsTitle: "",
                extractionHints: "",
                testPropertyTitlePdf: [],
                testBriefInformationPdf: [],
                aiConfig: DEFAULT_AI_CONFIG,
            };
        }
    }
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

  async function onSaveExtraction(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    try {
        await saveExtractionConfig({ 
            jsonStructure: values.jsonStructure,
            systemPrompt: values.systemPrompt,
            userPrompt: values.userPrompt,
            extractionHintsTitle: values.extractionHintsTitle,
            extractionHints: values.extractionHints,
        });
        toast({ title: 'Extraction Config Saved', description: 'The AI will now use the new structure and prompts.' });
    } catch (error: any) {
        console.error('Failed to save extraction config:', error);
        toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } finally {
        setIsSaving(false);
    }
  }
  
  async function onSaveAiSettings(values: z.infer<typeof formSchema>) {
      setIsSavingAiSettings(true);
      try {
          await saveAiConfig(values.aiConfig);
          toast({ title: 'AI Settings Saved', description: 'The global AI model configuration has been updated.' });
      } catch (error: any) {
          console.error('Failed to save AI settings:', error);
          toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
      } finally {
          setIsSavingAiSettings(false);
      }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">AI Configuration</h1>
        <p className="text-muted-foreground">
          Edit and test the JSON structure, prompts, and model parameters for AI data extraction. Your saved changes will be used globally.
        </p>
      </header>
      <main>
        <Form {...form}>
          <form>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Model Settings</CardTitle>
                    <CardDescription>Define the global AI model and its parameters.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <FormField
                        control={form.control}
                        name="aiConfig.model"
                        render={({ field }) => (
                           <FormItem>
                                <FormLabel>Model Name</FormLabel>
                                <Input {...field} placeholder="e.g., googleai/gemini-2.5-pro" value={field.value ?? ''} />
                                <FormMessage/>
                           </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-3 gap-4">
                           <FormField
                            control={form.control}
                            name="aiConfig.temperature"
                            render={({ field }) => (
                               <FormItem>
                                    <FormLabel>Temperature</FormLabel>
                                    <Input type="number" {...field} placeholder="e.g., 0.2" value={field.value ?? ''}/>
                                    <FormMessage/>
                               </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="aiConfig.topP"
                            render={({ field }) => (
                               <FormItem>
                                    <FormLabel>Top P</FormLabel>
                                    <Input type="number" {...field} placeholder="e.g., 1" value={field.value ?? ''}/>
                                    <FormMessage/>
                               </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="aiConfig.topK"
                            render={({ field }) => (
                               <FormItem>
                                    <FormLabel>Top K</FormLabel>
                                    <Input type="number" {...field} placeholder="e.g., 1" value={field.value ?? ''}/>
                                    <FormMessage/>
                               </FormItem>
                            )}
                          />
                      </div>
                      <FormField
                        control={form.control}
                        name="aiConfig.maxOutputTokens"
                        render={({ field }) => (
                           <FormItem>
                                <FormLabel>Max Output Tokens</FormLabel>
                                <Input type="number" {...field} placeholder="e.g., 8192" value={field.value ?? ''}/>
                                <FormMessage/>
                           </FormItem>
                        )}
                      />
                  </CardContent>
                </Card>
                 <Card>
                  <CardHeader>
                    <CardTitle>AI Prompts</CardTitle>
                    <CardDescription>Define the instructions for the AI extractor.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <FormField
                        control={form.control}
                        name="systemPrompt"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>System Prompt (AI's Role)</FormLabel>
                                <Textarea {...field} className="min-h-[100px] font-mono text-xs" />
                            </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="userPrompt"
                        render={({ field }) => (
                           <FormItem>
                                <FormLabel>User Prompt (Main Task)</FormLabel>
                                <Textarea {...field} className="min-h-[150px] font-mono text-xs" />
                           </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="extractionHintsTitle"
                        render={({ field }) => (
                           <FormItem>
                                <FormLabel>Extraction Hints Title</FormLabel>
                                <Input {...field} className="font-mono text-xs" />
                           </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="extractionHints"
                        render={({ field }) => (
                           <FormItem>
                                <FormLabel>Extraction Hints (Detailed Instructions)</FormLabel>
                                <Textarea {...field} className="min-h-[200px] font-mono text-xs" />
                           </FormItem>
                        )}
                      />
                  </CardContent>
                </Card>
                 <Card>
                  <CardHeader>
                    <CardTitle>AI Output Structure (JSON)</CardTitle>
                    <CardDescription>Define the JSON output format for the AI.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="jsonStructure"
                      render={({ field }) => (
                        <Textarea {...field} className="min-h-[400px] font-mono text-xs" />
                      )}
                    />
                  </CardContent>
                </Card>
                 <div className="flex justify-between rounded-md border bg-card p-4 text-card-foreground shadow-sm">
                    <Button type="button" onClick={form.handleSubmit(onSaveAiSettings)} disabled={isSavingAiSettings}>
                      {isSavingAiSettings ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving AI Settings...</>) : 'Save AI Settings'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={form.handleSubmit(onSaveExtraction)} disabled={isSaving}>
                      {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Extraction...</>) : 'Save Extraction Config'}
                    </Button>
                  </div>
              </div>
              <div className="space-y-6">
                <Card>
                    <CardHeader>
                      <CardTitle>Test Center</CardTitle>
                       <CardDescription>Upload files to test the extraction rules and prompts defined on the left.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="testPropertyTitlePdf" render={() => (<Controller name="testPropertyTitlePdf" control={form.control} render={({field}) => (<FileUploader label="Test Property Title (PDF)" value={field.value ?? []} onValueChange={field.onChange} options={{ accept: ACCEPTED_FILE_TYPES }} maxFiles={1} />)} />)} />
                      <FormField control={form.control} name="testBriefInformationPdf" render={() => (<Controller name="testBriefInformationPdf" control={form.control} render={({field}) => (<FileUploader label="Test Brief Information (PDF)" value={field.value ?? []} onValueChange={field.onChange} options={{ accept: ACCEPTED_FILE_TYPES }} maxFiles={1} />)} />)} />
                       <div className="flex justify-start pt-4">
                         <Button type="button" onClick={form.handleSubmit(onTestRun)} disabled={isTesting}>
                          {isTesting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...</>) : 'Run Test'}
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
          </form>
        </Form>
      </main>
    </div>
  );
}

    