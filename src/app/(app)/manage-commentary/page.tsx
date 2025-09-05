
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlusCircle, Trash2, ShieldX, Save } from 'lucide-react';
import { useForm, useFieldArray, type Control } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import { saveCommentaryOptions } from '@/ai/flows/save-commentary-options';
import { getCommentaryOptions } from '@/ai/flows/get-commentary-options';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { CommentaryOptionsData } from '@/lib/commentary-schema';
import { CommentaryOptionsSchema } from '@/lib/commentary-schema';

type CommentaryFieldArrayProps = {
    control: Control<CommentaryOptionsData>;
    name: keyof CommentaryOptionsData;
    label: string;
    description: string;
};

function CommentaryFieldArray({ control, name, label, description }: CommentaryFieldArrayProps) {
    const { fields, append, remove } = useFieldArray({
        control,
        name,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>{label}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {fields.map((field, index) => (
                    <FormField
                        key={field.id}
                        control={control}
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
}

export default function ManageCommentaryPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [initialData, setInitialData] = React.useState<CommentaryOptionsData | null>(null);

  const form = useForm<CommentaryOptionsData>({
    resolver: zodResolver(CommentaryOptionsSchema),
    defaultValues: {
      PreviousSale: [],
      ContractSale: [],
      SuppliedDocumentation: [],
      RecentOrProvided: [],
      LIM: [],
      PC78: [],
      OperativeZone: [],
    },
  });

  const { formState: { isDirty } } = form;

  React.useEffect(() => {
    async function loadCommentaries() {
      setIsLoading(true);
      try {
        const data = await getCommentaryOptions();
        form.reset(data);
        setInitialData(data);
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
      form.reset(values); // This will mark the form as not dirty
      setInitialData(values);
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
            <main className="space-y-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </main>
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
            <CommentaryFieldArray 
                control={form.control}
                name="PreviousSale"
                label="Previous Sale"
                description="Manage options for the [Replace_PreviousSale] section."
            />
             <CommentaryFieldArray 
                control={form.control}
                name="ContractSale"
                label="Contract for Sale"
                description="Manage options for the [Replace_ContractSale] section."
            />
             <CommentaryFieldArray 
                control={form.control}
                name="SuppliedDocumentation"
                label="Supplied Documentation"
                description="Manage options for the [Replace_SuppliedDoc] section."
            />
             <CommentaryFieldArray 
                control={form.control}
                name="RecentOrProvided"
                label="Recent/Provided"
                description="Manage options for the [Replace_RecentOrProvided] section."
            />
             <CommentaryFieldArray 
                control={form.control}
                name="LIM"
                label="Land Information Memorandum"
                description="Manage options for the [Replace_LIM] section."
            />
             <CommentaryFieldArray 
                control={form.control}
                name="PC78"
                label="Plan Change 78: Intensification"
                description="Manage options for the [Replace_PC78] section."
            />
            <CommentaryFieldArray 
                control={form.control}
                name="OperativeZone"
                label="Operative Zone"
                description="Manage options for the [Replace_Zone] section."
            />
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
