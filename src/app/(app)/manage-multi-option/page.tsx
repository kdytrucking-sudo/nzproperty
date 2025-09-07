'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlusCircle, Trash2, Save, Pencil, ShieldX } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MultiOptionsSchema, type MultiOptionsData, type MultiOptionCard } from '@/lib/multi-options-schema';
import { getMultiOptions } from '@/ai/flows/get-multi-options';
import { saveMultiOptions } from '@/ai/flows/save-multi-options';

const formSchema = z.object({
  cards: MultiOptionsSchema,
});
type FormValues = z.infer<typeof formSchema>;

export default function ManageMultiOptionPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [initialData, setInitialData] = React.useState<FormValues | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cards: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'cards',
  });
  
  const { formState: { isDirty } } = form;

  React.useEffect(() => {
    async function loadOptions() {
      setIsLoading(true);
      try {
        const data = await getMultiOptions();
        const initialFormValues = { cards: data };
        form.reset(initialFormValues);
        setInitialData(initialFormValues);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Failed to load options', description: error.message });
      } finally {
        setIsLoading(false);
      }
    }
    loadOptions();
  }, [form, toast]);
  
  const handleAddNewCard = () => {
    append({
      id: crypto.randomUUID(),
      cardName: 'New Card',
      placeholder: '[Replace_NewPlaceholder]',
      options: [{ id: crypto.randomUUID(), label: '', option: '' }],
    });
  };
  
  const handleAddNewOption = (cardIndex: number) => {
    const newOption = { id: crypto.randomUUID(), label: '', option: '' };
    const currentOptions = form.getValues(`cards.${cardIndex}.options`);
    form.setValue(`cards.${cardIndex}.options`, [...currentOptions, newOption]);
  };
  
  const handleRemoveOption = (cardIndex: number, optionIndex: number) => {
    const currentOptions = form.getValues(`cards.${cardIndex}.options`);
    const newOptions = currentOptions.filter((_, i) => i !== optionIndex);
    form.setValue(`cards.${cardIndex}.options`, newOptions);
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>, cardIndex: number, optionIndex: number) => {
    const { name, value } = e.target;
    const currentValues = form.getValues();
    const currentOption = currentValues.cards[cardIndex].options[optionIndex];

    if (name.endsWith('.option') && !currentOption.label) {
        form.setValue(`cards.${cardIndex}.options.${optionIndex}.label`, value);
    }
  };
  
  const handlePlaceholderBlur = (e: React.FocusEvent<HTMLInputElement>, cardIndex: number) => {
    let value = e.target.value;
    if (value && !value.startsWith('[')) {
        value = `[${value}`;
    }
    if (value && !value.endsWith(']')) {
        value = `${value}]`;
    }
    form.setValue(`cards.${cardIndex}.placeholder`, value);
  };

  async function onSave(values: FormValues) {
    setIsSaving(true);
    try {
      await saveMultiOptions(values.cards);
      form.reset(values);
      setInitialData(values);
      toast({
        title: 'Options Saved',
        description: 'Your multi-select options have been updated.',
      });
    } catch (error: any) {
      console.error('Failed to save options:', error);
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
                Manage Multi-Select Options
              </h1>
              <p className="text-muted-foreground">
                Create and configure cards with multiple selectable options for report generation.
              </p>
            </div>
            <Button type="button" onClick={handleAddNewCard}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Card
            </Button>
          </header>

          <main className="space-y-6">
            {fields.map((card, cardIndex) => (
              <Card key={card.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <FormField
                      control={form.control}
                      name={`cards.${cardIndex}.cardName`}
                      render={({ field }) => (
                          <FormItem className="w-1/3">
                              <FormControl>
                                <Input {...field} className="text-xl font-semibold tracking-tight" />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                    />
                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(cardIndex)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                   <FormField
                      control={form.control}
                      name={`cards.${cardIndex}.placeholder`}
                      render={({ field }) => (
                          <FormItem className="w-1/3">
                              <FormLabel>Placeholder</FormLabel>
                              <FormControl>
                                  <Input {...field} onBlur={(e) => handlePlaceholderBlur(e, cardIndex)} className="font-mono text-xs" />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                    />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-4 font-medium text-sm text-muted-foreground">Label</div>
                    <div className="col-span-7 font-medium text-sm text-muted-foreground">Option Text</div>
                    <div className="col-span-1"></div>
                  </div>
                  {form.watch(`cards.${cardIndex}.options`).map((option, optionIndex) => (
                    <div key={option.id} className="grid grid-cols-12 gap-4 items-start">
                      <FormField
                          control={form.control}
                          name={`cards.${cardIndex}.options.${optionIndex}.label`}
                          render={({ field }) => (
                              <FormItem className="col-span-4">
                                  <FormControl>
                                      <Input placeholder="Label for this option" {...field} />
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                       <FormField
                          control={form.control}
                          name={`cards.${cardIndex}.options.${optionIndex}.option`}
                          render={({ field }) => (
                              <FormItem className="col-span-7">
                                  <FormControl>
                                      <Textarea
                                          placeholder="Option text to be inserted into the report"
                                          {...field}
                                          onBlur={(e) => handleBlur(e, cardIndex, optionIndex)}
                                      />
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="col-span-1 mt-1"
                        onClick={() => handleRemoveOption(cardIndex, optionIndex)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                   <Button type="button" variant="outline" size="sm" onClick={() => handleAddNewOption(cardIndex)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Option
                  </Button>
                </CardFooter>
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
