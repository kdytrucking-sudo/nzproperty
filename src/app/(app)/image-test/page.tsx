'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, FileDown, TestTube2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { FileUploader } from '@/components/file-uploader';
import { testImageReplacement } from '@/ai/flows/test-image-replacement';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const ACCEPTED_DOCX_TYPES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};
const ACCEPTED_IMAGE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

const formSchema = z.object({
  template: z.array(z.instanceof(File)).min(1, 'A .docx template is required.'),
  image: z.array(z.instanceof(File)).min(1, 'An image file is required.'),
  placeholder: z.string().min(1, 'Placeholder text is required.'),
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
  const [resultUri, setResultUri] = React.useState<string | null>(null);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      template: [],
      image: [],
      placeholder: '{image_placeholder}',
    },
  });

  const handleDownload = () => {
    if (!resultUri) return;
    const link = document.createElement("a");
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
      const [templateDataUri, imageDataUri] = await Promise.all([
        fileToDataUri(values.template[0]),
        fileToDataUri(values.image[0]),
      ]);

      const result = await testImageReplacement({
        templateDataUri,
        imageDataUri,
        placeholder: values.placeholder,
      });

      setResultUri(result.generatedDocxDataUri);
      toast({
        title: 'Replacement Successful!',
        description: 'The new document is ready for download.',
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
          An isolated environment to test .docx image replacement functionality.
        </p>
      </header>

      <main>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Setup</CardTitle>
                <CardDescription>
                  Provide the template, image, and placeholder text to run the test.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                   <FormField
                      control={form.control}
                      name="template"
                      render={() => (
                          <Controller
                              name="template"
                              control={form.control}
                              render={({field}) => (
                                  <FileUploader
                                      label="Upload .docx Template"
                                      value={field.value}
                                      onValueChange={field.onChange}
                                      options={{ accept: ACCEPTED_DOCX_TYPES }}
                                      maxFiles={1}
                                  />
                              )}
                          />
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="image"
                      render={() => (
                          <Controller
                              name="image"
                              control={form.control}
                              render={({field}) => (
                                  <FileUploader
                                      label="Upload Image (.png, .jpg)"
                                      value={field.value}
                                      onValueChange={field.onChange}
                                      options={{ accept: ACCEPTED_IMAGE_TYPES }}
                                      maxFiles={1}
                                  />
                              )}
                          />
                      )}
                    />
                </div>
                 <FormField
                  control={form.control}
                  name="placeholder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image Placeholder in Template</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., {image_placeholder}" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>How it works</AlertTitle>
                  <AlertDescription>
                   In your template, insert a placeholder like <code>{'{image_placeholder}'}</code> (inside curly braces). The image module will use the dimensions of any placeholder image you've used in the template, so you can control the size and position.
                  </AlertDescription>
                </Alert>
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
