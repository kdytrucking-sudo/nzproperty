
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Download, FileUp, Image as ImageIcon } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import { FileUploader } from '@/components/file-uploader';
import { getImageOptions } from '@/ai/flows/get-image-options';
import type { ImageConfig } from '@/lib/image-options-schema';
import { testImageReplacement } from '@/ai/flows/test-image-replacement';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const ACCEPTED_DOCX_TYPES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const ACCEPTED_IMAGE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

// Dynamically build the schema based on image configs
const createFormSchema = (imageConfigs: ImageConfig[]) => {
  let imageSchemaPart = z.object({});
  imageConfigs.forEach(config => {
    imageSchemaPart = imageSchemaPart.extend({
      [config.placeholder]: z.array(z.instanceof(File)).min(1, `Image for ${config.cardName} is required.`),
    });
  });

  return z.object({
    templateDocx: z.array(z.instanceof(File)).min(1, 'A .docx template is required.'),
    images: imageSchemaPart,
  });
};


// Helper function to convert a file to a data URI
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
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [imageConfigs, setImageConfigs] = React.useState<ImageConfig[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = React.useState(true);
  const [formSchema, setFormSchema] = React.useState(z.object({
    templateDocx: z.array(z.instanceof(File)).min(1, 'A .docx template is required.'),
    images: z.object({}),
  }));

  React.useEffect(() => {
    async function loadConfigs() {
      setIsLoadingConfigs(true);
      try {
        const configs = await getImageOptions();
        setImageConfigs(configs);
        setFormSchema(createFormSchema(configs));
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Failed to load image configurations',
          description: error.message,
        });
      } finally {
        setIsLoadingConfigs(false);
      }
    }
    loadConfigs();
  }, [toast]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateDocx: [],
      images: {},
    },
  });
  
  // Effect to reset form defaultValues when configs load
  React.useEffect(() => {
    if (imageConfigs.length > 0) {
      const defaultImages = imageConfigs.reduce((acc, config) => {
        acc[config.placeholder] = [];
        return acc;
      }, {} as Record<string, File[]>);
      
      form.reset({
        templateDocx: [],
        images: defaultImages,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageConfigs, form.reset]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsGenerating(true);
    try {
        // Convert the template file
        const templateDataUri = await fileToDataUri(values.templateDocx[0]);

        // Convert all images
        const imagesDataUris: { [key: string]: string } = {};
        for (const placeholder in values.images) {
            const fileList = values.images[placeholder];
            if (fileList && fileList.length > 0) {
                imagesDataUris[placeholder] = await fileToDataUri(fileList[0]);
            }
        }

        // Call the Genkit flow
        const result = await testImageReplacement({
            templateDataUri: templateDataUri,
            imagesData: imagesDataUris,
        });
        
        // Handle the result
        const link = document.createElement("a");
        link.href = result.generatedDocxDataUri;
        link.download = `TEST_RESULT_${new Date().toISOString()}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: 'Report Generated',
            description: `Successfully replaced ${result.replacementsCount} image(s). Download has started.`,
        });

    } catch (error: any) {
        console.error('Test run failed:', error);
        toast({
            variant: 'destructive',
            title: 'Test Failed',
            description: error.message || 'An unknown error occurred.',
        });
    } finally {
        setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">Image Replacement Test</h1>
        <p className="text-muted-foreground">
          Test the image replacement functionality using a template and the configured placeholders.
        </p>
      </header>

      <main>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>1. Upload Template</CardTitle>
                <CardDescription>
                  Upload the master .docx template that contains the image placeholders e.g. <code>{'[%my_image]'}</code>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                    control={form.control}
                    name="templateDocx"
                    render={() => (
                        <Controller
                            name="templateDocx"
                            control={form.control}
                            render={({field}) => (
                                <FileUploader
                                    label="Template File (.docx)"
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    options={{ accept: ACCEPTED_DOCX_TYPES }}
                                    maxFiles={1}
                                />
                            )}
                        />
                    )}
                />
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>2. Upload Images</CardTitle>
                    <CardDescription>
                        Provide an image for each placeholder defined in the "Manage Images" section.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingConfigs ? (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                           <Skeleton className="h-48 w-full" />
                           <Skeleton className="h-48 w-full" />
                        </div>
                    ) : imageConfigs.length === 0 ? (
                       <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No Image Configurations Found</AlertTitle>
                            <AlertDescription>
                                Please go to the &quot;Manage Images&quot; page to create at least one image configuration to use this test page.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-2">
                            {imageConfigs.map((config) => (
                                <FormField
                                    key={config.id}
                                    control={form.control}
                                    name={`images.${config.placeholder}`}
                                    render={() => (
                                        <Controller
                                            name={`images.${config.placeholder}`}
                                            control={form.control}
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
                                    )}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
             <div className="flex justify-end">
                <Button type="submit" disabled={isGenerating || isLoadingConfigs || imageConfigs.length === 0}>
                    {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : 'Generate Test Document'}
                </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
