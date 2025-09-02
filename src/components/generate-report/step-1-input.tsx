'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { PropertyData } from '@/lib/types';
import { FileUploader } from '../file-uploader';
import { MapPreview } from '../map-preview';
import { extractPropertyData, type ExtractPropertyDataInput } from '@/ai/flows/extract-property-data-from-pdf';
import * as React from 'react';

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
};

const formSchema = z.object({
  address: z.string().min(1, 'Property address is required.'),
  propertyTitlePdf: z.array(z.instanceof(File)).min(1, 'Property Title PDF is required.'),
  briefInformationPdf: z.array(z.instanceof(File)).min(1, 'Brief Information PDF is required.'),
});

type Step1InputProps = {
  onDataExtracted: (data: PropertyData) => void;
};

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};


export function Step1Input({ onDataExtracted }: Step1InputProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [addressForMap, setAddressForMap] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      address: '',
      propertyTitlePdf: [],
      briefInformationPdf: [],
    },
  });

  const address = form.watch('address');

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsProcessing(true);
    try {
      if (!values.propertyTitlePdf?.[0] || !values.briefInformationPdf?.[0]) {
        throw new Error('PDF files are missing.');
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
      
      if (result && result.Property) {
        result.Property['Property Address'] = values.address;
      }

      toast({
        title: 'Data Extraction Successful',
        description: 'AI has processed the documents. Please review the data.',
      });
      onDataExtracted(result);
    } catch (error) {
      console.error('Error processing documents:', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'There was a problem processing your documents. Please try again.',
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
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Next: Review Data'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
