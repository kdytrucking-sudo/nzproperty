'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import initialContent from '@/lib/global-content.json';
import { saveGlobalContent } from '@/ai/flows/save-global-content';
import { contentFields, type ContentFormData, contentFormSchema } from '@/lib/content-config';


export default function ManageContentPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<ContentFormData>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: initialContent,
  });

  async function onSave(values: ContentFormData) {
    setIsSaving(true);
    try {
        await saveGlobalContent(values);
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
             <div className="flex justify-end">
                  <Button type="submit" disabled={isSaving}>
                      {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
                  </Button>
              </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
