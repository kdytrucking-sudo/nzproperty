'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, ShieldX } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import { saveGlobalContent } from '@/ai/flows/save-global-content';
import { getGlobalContent } from '@/ai/flows/get-global-content';
import { contentFields, type ContentFormData, contentFormSchema } from '@/lib/content-config';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


export default function ManageContentPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [initialData, setInitialData] = React.useState<ContentFormData | null>(null);

  const form = useForm<ContentFormData>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: async () => {
        setIsLoading(true);
        try {
            const data = await getGlobalContent();
            setInitialData(data);
            return data;
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to load content', description: error.message });
            // Return a default structure on error
            const defaultContent: Partial<ContentFormData> = {};
            contentFields.forEach(field => { defaultContent[field.name] = ''; });
            return defaultContent as ContentFormData;
        } finally {
            setIsLoading(false);
        }
    }
  });

  const { formState: { isDirty } } = form;

  async function onSave(values: ContentFormData) {
    setIsSaving(true);
    try {
        await saveGlobalContent(values);
        form.reset(values); // This will reset the dirty state
        setInitialData(values);
        toast({
            title: 'Content Saved',
            description: 'Your global content blocks have been updated.',
        });
    } catch (error: any) {
        console.error('Failed to save content:', error);
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
        <header>
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="mt-2 h-6 w-2/3" />
        </header>
        <main>
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-1/4" />
              <Skeleton className="mt-2 h-5 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-1/5" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }


  return (
    <div className="space-y-8">
       <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">
          Manage Global Content
        </h1>
        <p className="text-muted-foreground">
          Edit and save reusable content for your reports.
        </p>
      </header>

      <main>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Report Content Blocks</CardTitle>
                <CardDescription>
                  This content can be dynamically inserted into your report templates using the specified placeholders.
                </CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="space-y-6">
                    {contentFields.map((item) => (
                        <FormField
                        key={item.name}
                        control={form.control}
                        name={item.name}
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>{item.label}</FormLabel>
                              <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[{item.templateKey}]</code>
                            </div>
                            <FormControl>
                              <Textarea
                                placeholder={item.placeholder}
                                className="min-h-[150px] font-mono"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
              </CardContent>
            </Card>
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
          </form>
        </Form>
      </main>
    </div>
  );
}
