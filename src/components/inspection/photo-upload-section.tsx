
'use client';

import * as React from 'react';
import { Controller } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { getImageOptions } from '@/ai/flows/get-image-options';
import { uploadTempImage } from '@/ai/flows/upload-temp-image';
import type { ImageConfig } from '@/lib/image-options-schema';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { FileUploader } from '@/components/file-uploader';
import { FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ACCEPTED_IMAGE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

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
  file: File;
  state: ImageUploadState;
  tempFileName?: string;
  errorMessage?: string;
};

type PhotoUploadSectionProps = {
  control: any;
  selectedPlaceholder: string;
  setSelectedPlaceholder: (placeholder: string) => void;
};

export default function PhotoUploadSection({ control, selectedPlaceholder, setSelectedPlaceholder }: PhotoUploadSectionProps) {
  const { toast } = useToast();
  const [isLoadingConfigs, setIsLoadingConfigs] = React.useState(true);
  const [imageConfigs, setImageConfigs] = React.useState<ImageConfig[]>([]);
  const [imageFiles, setImageFiles] = React.useState<Record<string, ImageInfo | null>>({});

  React.useEffect(() => {
    async function loadConfigs() {
      setIsLoadingConfigs(true);
      try {
        const configs = await getImageOptions();
        setImageConfigs(configs);
        if (configs.length > 0) {
          setSelectedPlaceholder(configs[0].placeholder);
        }
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
  }, [toast, setSelectedPlaceholder]);
  
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
       toast({
          title: 'Image Uploaded',
          description: `"${file.name}" is ready.`
      });
    } catch (error: any) {
      console.error('Temp upload failed:', error);
      setImageFiles(prev => ({ 
          ...prev, 
          [placeholder]: { file, state: 'error', errorMessage: error.message }
      }));
       toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: error.message
      });
    }
  };

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
            <p className="mt-2 text-sm text-center font-medium">Upload successful</p>
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
  
  const selectedConfig = imageConfigs.find(c => c.placeholder === selectedPlaceholder);

  if (isLoadingConfigs) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (imageConfigs.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Configurations Found</AlertTitle>
        <AlertDescription>
          Please go to the "Manage Images" page to create at least one image configuration.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
        <FormItem>
            <FormLabel>Select Image to Upload</FormLabel>
            <Select value={selectedPlaceholder} onValueChange={setSelectedPlaceholder}>
                <SelectTrigger>
                    <SelectValue placeholder="Select an image..." />
                </SelectTrigger>
                <SelectContent>
                    {imageConfigs.map(config => (
                        <SelectItem key={config.id} value={config.placeholder}>
                            {config.cardName}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </FormItem>
        
        {selectedConfig && (
            <FormItem>
                <div className="h-36">
                    {renderImageUploader(selectedConfig)}
                </div>
                <FormLabel className="text-xs text-muted-foreground">
                    <code className="bg-muted px-1 py-0.5 rounded-sm">{selectedConfig.placeholder}</code>
                </FormLabel>
            </FormItem>
        )}
    </div>
  );
}
