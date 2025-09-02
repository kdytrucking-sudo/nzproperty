'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import { saveCommentaryOptions } from '@/ai/flows/save-commentary-options';
import { getCommentaryOptions, type CommentaryOptionsData } from '@/ai/flows/get-commentary-options';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  PreviousSale: z.array(z.string()),
  ContractSale: z.array(z.string()),
  Disclosure: z.array(z.string()),
  MarketComment: z.array(z.string()),
});

export default function ManageCommentaryPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  const form = useForm<CommentaryOptionsData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      PreviousSale: [],
      ContractSale: [],
      Disclosure: [],
      MarketComment: [],
    },
  });

  React.useEffect(() => {
    async function loadCommentaries() {
      setIsLoading(true);
      try {
        const data = await getCommentaryOptions();
        form.reset(data);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Failed to load commentaries', description: error.message });
      } finally {
        setIsLoading(false);
      }
    }
    loadCommentaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave(values: CommentaryOptionsData) {
    setIsSaving(true);
    try {
      await saveCommentaryOptions(values);
      toast({
        title: 'Commentary Saved',
        description: 'Your commentary options have been updated.',
      });
    } catch (error: any) {
      console.error('Failed to save commentaries:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  }

  const renderFieldArray = (name: keyof CommentaryOptionsData, label: string) => {
    const { fields, append, remove } = useFieldArray({
      control: form.control,
      name,
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle>{label}</CardTitle>
          <CardDescription>
            Manage the options for the <code className="bg-muted px-1 rounded-sm">[{name}]</code> commentary section. The first option will be the default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <FormField
              key={field.id}
              control={form.control}
              name={`${name}.${index}`}
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Textarea placeholder={`Option ${index + 1}`} {...field} className="font-mono"/>
                    </FormControl>
                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => append('')}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Option
          </Button>
        </CardContent>
      </Card>
    );
  };
  
  if (isLoading) {
    return (
        <div className="space-y-8">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-6 w-2/3" />
            <div className="space-y-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    )
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">
          Manage Commentary Options
        </h1>
        <p className="text-muted-foreground">
          Edit and save the reusable text blocks for the report commentary sections.
        </p>
      </header>

      <main>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
            {renderFieldArray('PreviousSale', 'Previous Sale Commentary')}
            {renderFieldArray('ContractSale', 'Contract Sale Commentary')}
            {renderFieldArray('Disclosure', 'Disclosure Commentary')}
            {renderFieldArray('MarketComment', 'Market Comment Commentary')}
            
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save All Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
