
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, FileDown, TestTube2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { FileUploader } from '@/components/file-uploader';
import { testImageReplacement } from '@/ai/flows/test-image-replacement';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { ImageConfig } from '@/lib/image-options-schema';
import { getImageOptions } from '@/ai/flows/get-image-options';
import { Skeleton } from '@/components/ui/skeleton';

const ACCEPTED_DOCX_TYPES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};
const ACCEPTED_IMAGE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

const formSchema = z.object({
  template: z.array(z.instanceof(File)).min(1, 'A .docx template is required.'),
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

export default function ImageTestPage() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [resultUri, setResultUri] = React.useState<string | null>(null);
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
      template: [],
      images: {},
    },
  });

  const handleDownload = () => {
    if (!resultUri) return;
    const link = document.createElement('a');
    link.href = resultUri;
    link.download = `test_result_${Date.now()}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  async function onSubmit(values: FormSchema) {
    setIsProcessing(true);
    setResultUri(null);
    try {
      const templateDataUri = await fileToDataUri(values.template[0]);
      
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
          description: 'Please upload at least one image to test the replacement.',
        });
        setIsProcessing(false);
        return;
      }

      const result = await testImageReplacement({
        templateDataUri,
        images: validImagesData,
      });

      setResultUri(result.generatedDocxDataUri);
      toast({
        title: 'Replacement Successful!',
        description: `Replaced ${validImagesData.length} image(s). The document is ready for download.`,
      });

    } catch (error: any) {
      console.error('Test failed:', error);
      toast({
        variant: 'destructive',
        title: 'Replacement Failed',
        description: error.message,
      });
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">Image Replacement Test</h1>
        <p className="text-muted-foreground">
          An isolated environment to test the image replacement functionality with a template and dynamic images.
        </p>
      </header>

      <main>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. Upload Template</CardTitle>
                <CardDescription>
                  Upload the master .docx template that contains the image placeholders you want to test.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="template"
                  render={({ field }) => (
                    <FileUploader
                      label=""
                      value={field.value}
                      onValueChange={field.onChange}
                      options={{ accept: ACCEPTED_DOCX_TYPES }}
                      maxFiles={1}
                    />
                  )}
                />
                 <FormMessage>{form.formState.errors.template?.message}</FormMessage>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>2. Upload Images</CardTitle>
                <CardDescription>
                  These configurations are loaded from your "Manage Images" page. Upload an image for each placeholder you want to test.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <div className="grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-2">
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
              </CardContent>
            </Card>


            <div className="flex justify-end gap-4">
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  <><TestTube2 className="mr-2 h-4 w-4" /> Run Test</>
                )}
              </Button>
              {resultUri && (
                <Button type="button" variant="secondary" onClick={handleDownload}>
                  <FileDown className="mr-2 h-4 w-4" /> Download Result
                </Button>
              )}
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
