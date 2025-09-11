'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, FileDown, AlertCircle, UploadCloud, CheckCircle2, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { FileUploader } from '@/components/file-uploader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { ImageConfig } from '@/lib/image-options-schema';
import { getImageOptions } from '@/ai/flows/get-image-options';
import { Skeleton } from '@/components/ui/skeleton';
import { uploadTempImage } from '@/ai/flows/upload-temp-image';
import { replaceImagesFromTemp } from '@/ai/flows/replace-images-from-temp';

const ACCEPTED_DOCX_TYPES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};
const ACCEPTED_IMAGE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

const formSchema = z.object({
  template: z.array(z.instanceof(File)).min(1, 'A .docx template is required.'),
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

// State for individual image uploader
type ImageUploadState = 'idle' | 'uploading' | 'success' | 'error';
type ImageInfo = {
  file: File;
  state: ImageUploadState;
  tempFileName?: string;
  errorMessage?: string;
};

export default function AdvancedImageTestPage() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isLoadingConfigs, setIsLoadingConfigs] = React.useState(true);
  const [resultUri, setResultUri] = React.useState<string | null>(null);
  const [imageConfigs, setImageConfigs] = React.useState<ImageConfig[]>([]);
  const [imageFiles, setImageFiles] = React.useState<Record<string, ImageInfo | null>>({});

  React.useEffect(() => {
    async function loadConfigs() {
      setIsLoadingConfigs(true);
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
        setIsLoadingConfigs(false);
      }
    }
    loadConfigs();
  }, [toast]);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      template: [],
    },
  });

  const handleImageChange = async (files: File[] | null, placeholder: string) => {
    const file = files?.[0];
    if (!file) {
      setImageFiles(prev => ({ ...prev, [placeholder]: null }));
      return;
    }

    setImageFiles(prev => ({ ...prev, [placeholder]: { file, state: 'uploading' } }));
    
    try {
      const fileDataUri = await fileToDataUri(file);
      const result = await uploadTempImage({ fileDataUri, originalFileName: file.name });
      
      setImageFiles(prev => ({ 
          ...prev, 
          [placeholder]: { file, state: 'success', tempFileName: result.tempFileName }
      }));
    } catch (error: any) {
      console.error('Temp upload failed:', error);
      setImageFiles(prev => ({ 
          ...prev, 
          [placeholder]: { file, state: 'error', errorMessage: error.message }
      }));
    }
  };


  const handleDownload = () => {
    if (!resultUri) return;
    const link = document.createElement('a');
    link.href = resultUri;
    link.download = `advanced_test_result_${Date.now()}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  async function onSubmit(values: FormSchema) {
    setIsProcessing(true);
    setResultUri(null);
    try {
      const templateDataUri = await fileToDataUri(values.template[0]);
      
      const imagesToReplace = Object.entries(imageFiles)
        .filter(([, info]) => info?.state === 'success' && info.tempFileName)
        .map(([placeholder, info]) => {
          const config = imageConfigs.find(c => c.placeholder === placeholder);
          if (!config || !info || !info.tempFileName) return null;
          return {
            placeholder: config.placeholder,
            tempFileName: info.tempFileName,
            width: config.width,
            height: config.height,
          };
        })
        .filter(Boolean) as { placeholder: string; tempFileName: string; width: number; height: number; }[];


      if (imagesToReplace.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Images Ready',
          description: 'Please upload at least one image successfully before replacing.',
        });
        setIsProcessing(false);
        return;
      }

      const result = await replaceImagesFromTemp({
        templateDataUri,
        images: imagesToReplace,
      });

      setResultUri(result.generatedDocxDataUri);
      toast({
        title: 'Replacement Successful!',
        description: `Replaced ${result.imagesReplacedCount} image(s). The document is ready for download.`,
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

  const renderImageUploader = (config: ImageConfig) => {
    const imageInfo = imageFiles[config.placeholder];

    if (imageInfo?.state === 'uploading') {
        return <div className="h-full flex flex-col items-center justify-center bg-muted/50 rounded-lg p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Uploading...</p>
        </div>
    }

    if (imageInfo?.state === 'success') {
        return <div className="h-full flex flex-col items-center justify-center bg-green-50 text-green-700 rounded-lg p-4 border border-green-200">
            <CheckCircle2 className="h-8 w-8" />
            <p className="mt-2 text-sm text-center font-medium">Ready for replacement</p>
            <p className="mt-1 text-xs text-center truncate w-full">{imageInfo.file.name}</p>
        </div>
    }
    
    if (imageInfo?.state === 'error') {
        return <div className="h-full flex flex-col items-center justify-center bg-red-50 text-destructive rounded-lg p-4 border border-red-200">
            <AlertCircle className="h-8 w-8" />
            <p className="mt-2 text-sm text-center font-medium">Upload Failed</p>
            <p className="mt-1 text-xs text-center truncate w-full">{imageInfo.errorMessage}</p>
        </div>
    }

    return <FileUploader
        label=""
        value={imageInfo?.file ? [imageInfo.file] : null}
        onValueChange={(files) => handleImageChange(files, config.placeholder)}
        options={{ accept: ACCEPTED_IMAGE_TYPES }}
        maxFiles={1}
        className="h-full"
    />
  }

  return (
    <div className="space-y-8">
      <header>
      <h1 className="font-headline text-3xl font-bold text-foreground">Advanced Image Replacement</h1>
        <p className="text-muted-foreground">
          A more robust workflow for replacing many images, uploading each one to a temporary store first.
        </p>
      </header>

      <main>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle>1. Upload Template</CardTitle>
                <CardDescription>
                  Upload your .docx report file that contains the image placeholders.
                </CardDescription>
              </CardHeader>
              <CardContent className="py-2">
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
                      className="h-24"
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
                  Each image will be uploaded to a temporary location as you select it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingConfigs ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(4)].map((_,i) => <Skeleton key={i} className="h-48 w-full" />)}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-8">
                    {imageConfigs.map((config) => (
                       <FormItem key={config.id}>
                            <FormLabel>{`${config.cardName} (${config.width}x${config.height}px)`}</FormLabel>
                            <div className="h-36">
                                {renderImageUploader(config)}
                            </div>
                            <FormLabel className="text-xs text-muted-foreground">
                                Placeholder: <code className="bg-muted px-1 py-0.5 rounded-sm">{config.placeholder}</code>
                            </FormLabel>
                        </FormItem>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>


            <div className="flex justify-end gap-4">
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Replacing...</>
                ) : (
                  <><FlaskConical className="mr-2 h-4 w-4" /> Replace All Ready Images</>
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
