'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlusCircle, Trash2, Save, ShieldX, Image as ImageIcon } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ImageOptionsSchema, type ImageOptionsData } from '@/lib/image-options-schema';
import { getImageOptions } from '@/ai/flows/get-image-options';
import { saveImageOptions } from '@/ai/flows/save-image-options';

const formSchema = z.object({
  configs: ImageOptionsSchema,
});
type FormValues = z.infer<typeof formSchema>;

export default function ManageImagesPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [initialData, setInitialData] = React.useState<FormValues | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      configs: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'configs',
  });
  
  const { formState: { isDirty } } = form;

  React.useEffect(() => {
    async function loadOptions() {
      setIsLoading(true);
      try {
        const data = await getImageOptions();
        const initialFormValues = { configs: data };
        form.reset(initialFormValues);
        setInitialData(initialFormValues);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Failed to load image configs', description: error.message });
      } finally {
        setIsLoading(false);
      }
    }
    loadOptions();
  }, [form, toast]);
  
  const handleAddNewCard = () => {
    append({
      id: crypto.randomUUID(),
      cardName: 'New Image',
      placeholder: '[%new_image]',
      width: 600,
      height: 400,
    });
  };
  
  const handlePlaceholderBlur = (e: React.FocusEvent<HTMLInputElement>, cardIndex: number) => {
    let value = e.target.value.trim();
    // Remove any existing delimiters to start clean
    value = value.replace(/^\[%?/, '').replace(/\]$/, '');
    // Add the correct delimiters
    value = `[%${value}]`;
    form.setValue(`configs.${cardIndex}.placeholder`, value, { shouldDirty: true });
  };

  async function onSave(values: FormValues) {
    setIsSaving(true);
    try {
      await saveImageOptions(values.configs);
      form.reset(values);
      setInitialData(values);
      toast({
        title: 'Configurations Saved',
        description: 'Your image configurations have been updated.',
      });
    } catch (error: any) {
      console.error('Failed to save image configs:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  }
  
  function handleRevert() {
      if(initialData) {
          form.reset(initialData);
          toast({
              title: 'Changes Reverted',
              description: 'Your changes have been discarded.'
          });
      }
  }

  if (isLoading) {
    return (
        <div className="space-y-8">
            <header className="flex items-center justify-between">
              <div>
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="mt-2 h-6 w-2/3" />
              </div>
              <Skeleton className="h-10 w-32" />
            </header>
            <main className="space-y-6">
                <Skeleton className="h-64 w-full" />
            </main>
        </div>
    )
  }

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSave)}>
          <header className="flex items-center justify-between">
            <div>
              <h1 className="font-headline text-3xl font-bold text-foreground">
                Manage Image Configurations
              </h1>
              <p className="text-muted-foreground">
                Define reusable image placeholders with their default dimensions for reports.
              </p>
            </div>
            <Button type="button" onClick={handleAddNewCard}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Image Config
            </Button>
          </header>

          <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fields.map((card, cardIndex) => (
              <Card key={card.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary rounded-md">
                        <ImageIcon className="h-6 w-6 text-secondary-foreground" />
                      </div>
                      <FormField
                        control={form.control}
                        name={`configs.${cardIndex}.cardName`}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                  <Input {...field} className="text-lg font-semibold tracking-tight border-0 shadow-none px-1 -ml-1" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(cardIndex)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                      control={form.control}
                      name={`configs.${cardIndex}.placeholder`}
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Placeholder Tag</FormLabel>
                              <FormControl>
                                  <Input {...field} onBlur={(e) => handlePlaceholderBlur(e, cardIndex)} className="font-mono text-sm" placeholder="e.g., [%property_photo]" />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                          control={form.control}
                          name={`configs.${cardIndex}.width`}
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Width (px)</FormLabel>
                                  <FormControl>
                                      <Input type="number" {...field} placeholder="e.g., 600" />
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name={`configs.${cardIndex}.height`}
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Height (px)</FormLabel>
                                  <FormControl>
                                      <Input type="number" {...field} placeholder="e.g., 400" />
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                    </div>
                </CardContent>
              </Card>
            ))}
             {isDirty && (
                 <div className="fixed bottom-6 right-6 z-50 w-full max-w-md">
                     <Alert variant="destructive" className="bg-destructive/95 text-destructive-foreground shadow-lg backdrop-blur-sm">
                        <AlertTitle className="font-bold">You have unsaved changes!</AlertTitle>
                        <AlertDescription className="text-destructive-foreground/90">
                           Save your changes to make them available across the app.
                        </AlertDescription>
                        <div className="mt-4 flex gap-x-2 justify-end">
                            <Button type="button" variant="outline" size="sm" onClick={handleRevert} className="bg-transparent border-destructive-foreground/50 text-destructive-foreground hover:bg-destructive-foreground/10 hover:text-destructive-foreground">
                                <ShieldX className="mr-2 h-4 w-4"/> Revert
                            </Button>
                            <Button type="submit" variant="secondary" size="sm" disabled={isSaving} className="bg-destructive-foreground text-destructive hover:bg-destructive-foreground/90">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                                Save Changes
                            </Button>
                        </div>
                    </Alert>
                </div>
            )}
          </main>
        </form>
      </Form>
    </div>
  );
}
