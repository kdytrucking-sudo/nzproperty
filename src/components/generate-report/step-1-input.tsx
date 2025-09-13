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
import { MapPreview } from '../map-preview';
import { extractPropertyData, type ExtractPropertyDataInput } from '@/ai/flows/extract-property-data-from-pdf';
import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { listDrafts } from '@/ai/flows/list-drafts';
import { getDraft } from '@/ai/flows/get-draft';
import type { Draft, DraftSummary } from '@/lib/drafts-schema';
import { Skeleton } from '../ui/skeleton';

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
  const [addressForMap, setAddressForMap] = React.useState<string | null>(null);
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
        setAddressForMap(selected.propertyAddress);
        setSelectedDraftId(draftId);
    }
  };
  
  const handleLoadDraft = async () => {
    if (!selectedDraftId) {
        toast({ variant: 'destructive', title: 'No Draft Selected', description: 'Please choose a draft from the list.' });
        return;
    }
    setIsDraftLoading(true);
    try {
        const draft = await getDraft({ draftId: selectedDraftId });
        if (draft) {
            onDraftLoaded(draft.formData);
            toast({ title: 'Draft Loaded', description: `Successfully loaded draft for ${draft.propertyAddress}.`});
        } else {
            throw new Error('Draft not found on the server.');
        }
    } catch (error: any) {
        console.error('Failed to load draft:', error);
        toast({ variant: 'destructive', title: 'Failed to load draft', description: error.message });
    } finally {
        setIsDraftLoading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsProcessing(true);
    try {
      if (!values.propertyTitlePdf?.[0] || !values.briefInformationPdf?.[0]) {
        throw new Error('PDF files for AI extraction are missing.');
      }

      const [propertyTitlePdfDataUri, briefInformationPdfDataUri] = await Promise.all([
        fileToDataUri(values.propertyTitlePdf[0]),
        fileToDataUri(values.briefInformationPdf[0]),
      ]);

      const input: ExtractPropertyDataInput = {
        propertyTitlePdfDataUri,
        briefInformationPdfDataUri,
      };

      const result: PropertyData = await extractPropertyData(input);
      
      if (result && result.Info) {
        result.Info['Property Address'] = values.address;
      }

      toast({
        title: 'Data Extraction Successful',
        description: 'AI has processed the documents. Please review the data.',
      });
      onDataExtracted(result);
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

  const handleUpdateMap = () => {
    setAddressForMap(address);
  };

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
                        <CardDescription>Select a previously saved draft to continue your work.</CardDescription>
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
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input placeholder="e.g., 123 Queen Street, Auckland" {...field} />
                        </FormControl>
                         <Button type="button" variant="secondary" onClick={handleUpdateMap}>Update</Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <MapPreview address={addressForMap} />
              </div>

              <div className="space-y-6">
                <p className="text-sm font-medium text-center text-muted-foreground border-b pb-2">Or, start a new report</p>
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
