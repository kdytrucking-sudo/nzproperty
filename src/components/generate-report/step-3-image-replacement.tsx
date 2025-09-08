'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, FileImage, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { FileUploader } from '@/components/file-uploader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { ImageConfig } from '@/lib/image-options-schema';
import { getImageOptions } from '@/ai/flows/get-image-options';
import { addImagesToReport } from '@/ai/flows/add-images-to-report';
import { Skeleton } from '@/components/ui/skeleton';

const ACCEPTED_IMAGE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

const formSchema = z.object({
  images: z.record(z.string(), z.array(z.instanceof(File)).optional()),
});

type FormSchema = z.infer<typeof formSchema>;

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

type Step3Props = {
    tempFileName: string;
    initialReplacements: number;
    onReportGenerated: (finalReportUri: string, totalReplacements: number) => void;
    onBack: () => void;
}

export function Step3ImageReplacement({ tempFileName, initialReplacements, onReportGenerated, onBack }: Step3Props) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [imageConfigs, setImageConfigs] = React.useState<ImageConfig[]>([]);

  React.useEffect(() => {
    async function loadConfigs() {
      setIsLoading(true);
      try {
        const configs = await getImageOptions();
        setImageConfigs(configs);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Failed to load configurations',
          description: error.message,
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadConfigs();
  }, [toast]);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      images: {},
    },
  });

  async function onSubmit(values: FormSchema) {
    setIsProcessing(true);
    try {
      const imagesData = await Promise.all(
        Object.entries(values.images)
          .filter(([, files]) => files && files.length > 0)
          .map(async ([placeholder, files]) => {
            if (!files || files.length === 0) return null;
            const config = imageConfigs.find(c => c.placeholder === placeholder);
            if (!config) return null;
            
            const imageDataUri = await fileToDataUri(files[0]);
            return {
              placeholder: config.placeholder,
              imageDataUri,
              width: config.width,
              height: config.height,
            };
          })
      );
      
      const validImagesData = imagesData.filter(Boolean) as { placeholder: string; imageDataUri: string; width: number; height: number; }[];

      if (validImagesData.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Images Provided',
          description: 'Please upload at least one image or click skip.',
        });
        setIsProcessing(false);
        return;
      }

      const result = await addImagesToReport({
        tempFileName,
        images: validImagesData,
      });
      
      const totalReplacements = initialReplacements + result.imagesReplacedCount;

      toast({
        title: 'Replacement Successful!',
        description: `Replaced ${result.imagesReplacedCount} image(s). The document is ready for download.`,
      });

      onReportGenerated(result.generatedDocxDataUri, totalReplacements);

    } catch (error: any) {
      console.error('Image replacement failed:', error);
      toast({
        variant: 'destructive',
        title: 'Replacement Failed',
        description: error.message,
      });
    } finally {
      setIsProcessing(false);
    }
  }

  // Handle skipping the image step
  async function handleSkip() {
    setIsProcessing(true);
     try {
       const result = await addImagesToReport({
        tempFileName,
        images: [], // Pass empty array to just get the file back
      });
       onReportGenerated(result.generatedDocxDataUri, initialReplacements);
       toast({
        title: 'Image Step Skipped',
        description: `The final report is ready for download.`,
      });
    } catch (error: any) {
       console.error('Skip failed:', error);
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: error.message,
      });
    } finally {
       setIsProcessing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Replace Images</CardTitle>
        <CardDescription>
          Upload an image for each placeholder. These are based on your global settings in "Manage Images". You can also skip this step.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <main>
              {isLoading ? (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                  </div>
                ) : imageConfigs.length === 0 ? (
                  <Alert variant="destructive">
                     <AlertCircle className="h-4 w-4" />
                     <AlertTitle>No Configurations Found</AlertTitle>
                     <AlertDescription>
                        Please go to the "Manage Images" page to create at least one image configuration.
                     </AlertDescription>
                   </Alert>
                ) : (
                  <div className="grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-3">
                    {imageConfigs.map((config) => (
                       <FormField
                          key={config.id}
                          control={form.control}
                          name={`images.${config.placeholder}`}
                          render={({ field }) => (
                            <FormItem>
                               <FileUploader
                                  label={`${config.cardName} (${config.width}x${config.height}px)`}
                                  value={field.value ?? null}
                                  onValueChange={field.onChange}
                                  options={{ accept: ACCEPTED_IMAGE_TYPES }}
                                  maxFiles={1}
                                />
                                <FormLabel className="text-xs text-muted-foreground">
                                  Placeholder: <code className="bg-muted px-1 py-0.5 rounded-sm">{config.placeholder}</code>
                                </FormLabel>
                                <FormMessage />
                            </FormItem>
                          )}
                        />
                    ))}
                  </div>
                )}
            </main>

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={onBack} disabled={isProcessing}>
                Back
              </Button>
              <div className="flex gap-4">
                <Button type="button" variant="secondary" onClick={handleSkip} disabled={isProcessing}>
                  Skip & Generate
                </Button>
                <Button type="submit" disabled={isProcessing || isLoading || imageConfigs.length === 0}>
                  {isProcessing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                  ) : (
                    <><FileImage className="mr-2 h-4 w-4" /> Generate Final Report</>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
