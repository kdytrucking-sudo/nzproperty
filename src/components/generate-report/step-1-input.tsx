'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, BookDown } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { PropertyData } from '@/lib/types';
import { FileUploader } from '../file-uploader';
import { extractPropertyData } from '@/ai/flows/extract-property-data-from-pdf';
import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { listDrafts } from '@/ai/flows/list-drafts';
import { getDraft } from '@/ai/flows/get-draft';
import type { Draft, DraftSummary } from '@/lib/drafts-schema';
import { Skeleton } from '../ui/skeleton';
import { mergeAiDataWithDraft } from '@/ai/flows/merge-ai-data-with-draft';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info } from 'lucide-react';
import { getExtractionConfig } from '@/ai/flows/get-extraction-config';
import { set } from 'date-fns';

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
};

const formSchema = z.object({
  address: z.string().min(1, 'Property address is required.'),
  propertyTitlePdf: z.array(z.instanceof(File)).optional(),
  briefInformationPdf: z.array(z.instanceof(File)).optional(),
});

type Step1InputProps = {
  onDataExtracted: (data: PropertyData) => void;
  onDraftLoaded: (draftData: Draft['formData']) => void;
};

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};


export function Step1Input({ onDataExtracted, onDraftLoaded }: Step1InputProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isDraftLoading, setIsDraftLoading] = React.useState(false);
  const [drafts, setDrafts] = React.useState<DraftSummary[]>([]);
  const [selectedDraftId, setSelectedDraftId] = React.useState<string>('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      address: '',
      propertyTitlePdf: [],
      briefInformationPdf: [],
    },
  });

  const address = form.watch('address');

  React.useEffect(() => {
    async function loadDrafts() {
      try {
        const draftList = await listDrafts();
        setDrafts(draftList);
      } catch (error) {
        console.error('Failed to load drafts:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to load drafts',
          description: 'Could not retrieve the list of saved drafts.',
        });
      }
    }
    loadDrafts();
  }, [toast]);
  
  const handleDraftSelection = (draftId: string) => {
    const selected = drafts.find(d => d.draftId === draftId);
    if(selected) {
        form.setValue('address', selected.propertyAddress);
        setSelectedDraftId(draftId);
    } else {
        setSelectedDraftId('');
    }
  };
  
  const handleLoadDraft = async () => {
    if (!selectedDraftId) {
        toast({ variant: 'destructive', title: 'No Draft Selected', description: 'Please choose a draft from the list.' });
        return;
    }
    setIsDraftLoading(true);
    try {
        const draftResponse = await getDraft({ draftId: selectedDraftId });
        const draft = draftResponse?.draft;

        if (draft && draft.formData) {
            // "Data补全" step to ensure UI consistency
            const config = await getExtractionConfig();
            const jsonStructure = JSON.parse(config.jsonStructure);
            const defaultData: any = {};
            Object.keys(jsonStructure).forEach(sectionKey => {
                defaultData[sectionKey] = {};
                Object.keys(jsonStructure[sectionKey]).forEach(fieldKey => {
                    defaultData[sectionKey][fieldKey] = '';
                });
            });

            // Deep merge draft data over the default structure with safety checks
            const draftFormData = draft.formData.data || {};
            const completeData = {
                ...defaultData,
                ...draftFormData,
                Info: {...defaultData.Info, ...(draftFormData.Info || {})},
                'General Info': {...defaultData['General Info'], ...(draftFormData['General Info'] || {})}
            };
            
            const completedDraft = {
                ...draft.formData,
                data: completeData
            };
            
            onDraftLoaded(completedDraft);
            toast({ title: 'Draft Loaded', description: `Successfully loaded draft for ${draft.propertyAddress}.`});
        } else {
            throw new Error('Draft not found or is corrupted on the server.');
        }
    } catch (error: any) {
        console.error('Failed to load draft:', error);
        toast({ variant: 'destructive', title: 'Failed to load draft', description: error.message });
    } finally {
        setIsDraftLoading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const hasPdfs = values.propertyTitlePdf?.[0] && values.briefInformationPdf?.[0];
    const hasDraft = selectedDraftId;

    if (!hasPdfs) {
        toast({
            variant: 'destructive',
            title: 'Missing Files',
            description: 'Please upload both Property Title and Brief Information PDFs to proceed.',
        });
        return;
    }

    setIsProcessing(true);

    try {
        const [propertyTitlePdfDataUri, briefInformationPdfDataUri] = await Promise.all([
            fileToDataUri(values.propertyTitlePdf[0]),
            fileToDataUri(values.briefInformationPdf[0]),
        ]);

        if (hasDraft) {
            // Scenario C: Merge AI data with selected draft
            toast({ title: 'Merging Data...', description: 'AI is extracting data and merging it with your selected draft.' });
            const mergedFormData = await mergeAiDataWithDraft({
                draftId: selectedDraftId,
                propertyTitlePdfDataUri,
                briefInformationPdfDataUri,
            });
            // The merged data is already in the full formData structure
            onDraftLoaded(mergedFormData);

        } else {
            // Scenario A: Extract from PDFs only
             toast({ title: 'Extracting Data...', description: 'AI is processing the documents.' });
            const result: PropertyData = await extractPropertyData({
                propertyTitlePdfDataUri,
                briefInformationPdfDataUri,
            });
            
            if (result && result.Info) {
                result.Info['Property Address'] = values.address;
            }

            toast({
                title: 'Data Extraction Successful',
                description: 'AI has processed the documents. Please review the data.',
            });
            onDataExtracted(result);
        }
    } catch (error: any) {
        console.error('Error processing documents:', error);
        toast({
            variant: 'destructive',
            title: 'Uh oh! Something went wrong.',
            description: error.message || 'There was a problem processing your documents.',
        });
    } finally {
        setIsProcessing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Provide Property Information</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="space-y-6">
                <Card className="bg-muted/50">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Load Existing Draft</CardTitle>
                        <CardDescription>Select a draft to load its data directly for review.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="flex items-center gap-2">
                            {drafts.length === 0 ? (
                                <Skeleton className="h-10 w-full" />
                            ) : (
                                <Select onValueChange={handleDraftSelection}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a draft..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                    {drafts.map(d => (
                                        <SelectItem key={d.draftId} value={d.draftId}>
                                            {d.propertyAddress}
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Button type="button" onClick={handleLoadDraft} disabled={isDraftLoading || !selectedDraftId}>
                                {isDraftLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BookDown className="mr-2 h-4 w-4" />}
                                Load Draft
                            </Button>
                        </div>
                    </CardContent>
                 </Card>
                 <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <label className="text-sm font-medium">Property Address</label>
                      <FormControl>
                        <Input placeholder="e.g., 123 Queen Street, Auckland" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-6">
                <CardHeader className="p-0">
                  <CardTitle className="text-lg">Start New or Merge</CardTitle>
                  <CardDescription>Upload PDFs to start a new report, or to merge with a selected draft.</CardDescription>
                </CardHeader>
                
                <FormField
                  control={form.control}
                  name="propertyTitlePdf"
                  render={() => (
                     <Controller
                        name="propertyTitlePdf"
                        control={form.control}
                        render={({field}) => (
                            <FileUploader
                                label="Upload Property Title (PDF)"
                                value={field.value}
                                onValueChange={field.onChange}
                                options={{ accept: ACCEPTED_FILE_TYPES }}
                                maxFiles={1}
                            />
                        )}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="briefInformationPdf"
                  render={() => (
                    <Controller
                        name="briefInformationPdf"
                        control={form.control}
                        render={({field}) => (
                            <FileUploader
                                label="Upload Brief Information (PDF)"
                                value={field.value}
                                onValueChange={field.onChange}
                                options={{ accept: ACCEPTED_FILE_TYPES }}
                                maxFiles={1}
                            />
                        )}
                    />
                  )}
                />
                 {selectedDraftId && (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Merge Mode Activated</AlertTitle>
                        <AlertDescription>
                           You have selected a draft. Clicking below will extract data from the PDFs and merge it with your draft, prioritizing existing draft data.
                        </AlertDescription>
                    </Alert>
                 )}
                 <div className="flex justify-end">
                    <Button type="submit" disabled={isProcessing}>
                        {isProcessing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                        </>
                        ) : (
                        'Extract Data & Review'
                        )}
                    </Button>
                </div>
              </div>
            </div>

          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
