'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, FileDown, AlertCircle, UploadCloud, CheckCircle2, FlaskConical, X, Terminal } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listReports, type ReportFile } from '@/ai/flows/list-reports';
import { performImageReplacement } from '@/ai/flows/perform-image-replacement';

const ACCEPTED_IMAGE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};


const formSchema = z.object({
  reportFileName: z.string().min(1, 'Please select a report file.'),
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

type ImageUploadState = 'idle' | 'uploading' | 'success' | 'error';
type ImageInfo = {
  file?: File;
  state: ImageUploadState;
  tempFileName?: string;
  fullPath?: string; // For debugging
  errorMessage?: string;
};

export default function ImageTestPage() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [resultUri, setResultUri] = React.useState<string | null>(null);
  const [resultFileName, setResultFileName] = React.useState<string>('');
  
  const [isLoadingConfigs, setIsLoadingConfigs] = React.useState(true);
  const [imageConfigs, setImageConfigs] = React.useState<ImageConfig[]>([]);
  const [imageFiles, setImageFiles] = React.useState<Record<string, ImageInfo | null>>({});
  
  const [reports, setReports] = React.useState<ReportFile[]>([]);
  const [isLoadingReports, setIsLoadingReports] = React.useState(true);

  const [logs, setLogs] = React.useState<string[]>([]);

  React.useEffect(() => {
    async function loadInitialData() {
      setIsLoadingConfigs(true);
      setIsLoadingReports(true);
      try {
        const [configs, reportList] = await Promise.all([
          getImageOptions(),
          listReports(),
        ]);
        setImageConfigs(configs);
        setReports(reportList);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Failed to load initial data',
          description: error.message,
        });
      } finally {
        setIsLoadingConfigs(false);
        setIsLoadingReports(false);
      }
    }
    loadInitialData();
  }, [toast]);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reportFileName: '',
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
          [placeholder]: { file, state: 'success', tempFileName: result.tempFileName, fullPath: result.fullPath }
      }));
    } catch (error: any) {
      console.error('Upload failed:', error);
      setImageFiles(prev => ({ 
          ...prev, 
          [placeholder]: { file, state: 'error', errorMessage: error.message }
      }));
    }
  };

  const handleRemoveImage = (placeholder: string) => {
    setImageFiles(prev => ({...prev, [placeholder]: null}));
  }

  const handleDownload = () => {
    if (!resultUri) return;
    const link = document.createElement('a');
    link.href = resultUri;
    link.download = resultFileName || `image_test_result_${Date.now()}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const isAnyImageUploading = React.useMemo(() => {
    return Object.values(imageFiles).some(info => info?.state === 'uploading');
  }, [imageFiles]);


  async function onSubmit(values: FormSchema) {
    setIsProcessing(true);
    setResultUri(null);
    setResultFileName('');
    setLogs([]);

    try {
      const imagesToReplace = Object.entries(imageFiles)
        .filter(([, info]) => info?.state === 'success' && info.tempFileName)
        .map(([placeholder, info]) => {
          const config = imageConfigs.find(c => c.placeholder === placeholder);
          if (!config || !info || !info.tempFileName) return null;
          return {
            placeholder: config.placeholder,
            imageFileName: info.tempFileName,
            width: config.width,
            height: config.height,
          };
        })
        .filter(Boolean) as { placeholder: string; imageFileName: string; width: number; height: number; }[];


      if (imagesToReplace.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Images Ready',
          description: 'Please upload at least one image successfully before replacing.',
        });
        setIsProcessing(false);
        return;
      }

      const result = await performImageReplacement({
        reportFileName: values.reportFileName,
        images: imagesToReplace,
      });

      setLogs(result.logs);
      
      if (!result.generatedDocxDataUri) {
         throw new Error("Image replacement process failed. Check logs for details.");
      }

      setResultUri(result.generatedDocxDataUri);
      setResultFileName(values.reportFileName);
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
      setLogs(prev => [...prev, `[FRONTEND ERROR] ${error.message}`]);
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
        return (
          <div className="relative h-full flex flex-col items-center justify-center bg-green-50 text-green-700 rounded-lg p-4 border border-green-200">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveImage(config.placeholder)}
                className="absolute top-1 right-1 h-6 w-6 text-green-800 hover:bg-green-100 hover:text-destructive"
                aria-label="Replace image"
            >
                <X className="h-4 w-4" />
            </Button>
            <CheckCircle2 className="h-8 w-8" />
            <p className="mt-2 text-sm text-center font-medium">Ready for replacement</p>
            {imageInfo.fullPath && <p className="mt-1 text-xs text-center break-all font-mono">{imageInfo.fullPath}</p>}
          </div>
        )
    }
    
    if (imageInfo?.state === 'error') {
        return <div className="relative h-full flex flex-col items-center justify-center bg-red-50 text-destructive rounded-lg p-4 border border-red-200">
             <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveImage(config.placeholder)}
                className="absolute top-1 right-1 h-6 w-6 hover:bg-red-100"
                aria-label="Try again"
            >
                <X className="h-4 w-4" />
            </Button>
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
      <h1 className="font-headline text-3xl font-bold text-foreground">Isolated Image Replacement Test</h1>
        <p className="text-muted-foreground">
          A dedicated page to test image replacement using files from cloud storage.
        </p>
      </header>

      <main>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle>1. Select Report File</CardTitle>
                <CardDescription>
                  Choose a generated report from the `reports/` directory in storage.
                </CardDescription>
              </CardHeader>
              <CardContent className="py-2">
                <FormField
                  control={form.control}
                  name="reportFileName"
                  render={({ field }) => (
                    <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a report to modify..." />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {isLoadingReports ? (
                                    <SelectItem value="loading" disabled>Loading reports...</SelectItem>
                                ) : reports.length > 0 ? (
                                    reports.map(r => (
                                    <SelectItem key={r.name} value={r.name}>
                                        {r.name}
                                    </SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="none" disabled>No reports found in storage</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>2. Upload Images</CardTitle>
                <CardDescription>
                  Upload an image for each placeholder. The image will be saved to the `images/` directory in storage.
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
              <Button type="submit" disabled={isProcessing || isAnyImageUploading}>
                {isProcessing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Replacing...</>
                ) : (
                  <><FlaskConical className="mr-2 h-4 w-4" /> Replace Images</>
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
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Replacement Logs
                </CardTitle>
                <CardDescription>
                    Detailed logs from the backend replacement process will appear here.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <pre className="w-full h-64 rounded-md bg-muted p-4 text-xs text-muted-foreground overflow-auto font-mono">
                    {logs.length > 0 ? logs.join('\n') : 'Logs will be displayed here after running the replacement...'}
                </pre>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
