'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';

export const contentStorageKey = 'globalReportContent';

const formSchema = z.object({
  nzEconomicOverview: z.string(),
  globalEconomicOverview: z.string(),
  residentialMarket: z.string(),
  recentMarketDirection: z.string(),
  marketVolatility: z.string(),
  localEconomyImpact: z.string(),
});

type ContentFormData = z.infer<typeof formSchema>;

export const contentFields: { name: keyof ContentFormData; label: string, placeholder: string, templateKey: string }[] = [
    { name: "nzEconomicOverview", label: "New Zealand Economy Overview", placeholder: "Enter New Zealand Economy Overview...", templateKey: "TermText_NZEconomic" },
    { name: "globalEconomicOverview", label: "Global Economic Overview", placeholder: "Enter Global Economic Overview...", templateKey: "TermText_GlobalEconomic" },
    { name: "residentialMarket", label: "Residential Market", placeholder: "Enter Residential Market details...", templateKey: "TermText_ResidentialMarket" },
    { name: "recentMarketDirection", label: "Recent Market Direction", placeholder: "Enter Recent Market Direction...", templateKey: "TermText_RecentMarketDirection" },
    { name: "marketVolatility", label: "Market Volatility", placeholder: "Enter Market Volatility information...", templateKey: "TermText_MarketVolatility" },
    { name: "localEconomyImpact", label: "Local Economy Impact", placeholder: "Enter Local Economy Impact analysis...", templateKey: "TermText_LocalEconomyImpact" },
] as const;


export default function ManageContentPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);

  const form = useForm<ContentFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nzEconomicOverview: '',
      globalEconomicOverview: '',
      residentialMarket: '',
      recentMarketDirection: '',
      marketVolatility: '',
      localEconomyImpact: '',
    },
  });

  // Load from localStorage on mount
  React.useEffect(() => {
    const savedContent = localStorage.getItem(contentStorageKey);
    if (savedContent) {
      try {
        const parsedContent = JSON.parse(savedContent);
        form.reset(parsedContent);
      } catch (e) {
        console.error("Failed to parse saved content", e);
      }
    }
    setIsLoaded(true);
  }, [form]);

  // Autosave to localStorage on change
  React.useEffect(() => {
    if (!isLoaded) return;

    const subscription = form.watch((values) => {
      setIsSaving(true);
      localStorage.setItem(contentStorageKey, JSON.stringify(values));
      // Simulate a small delay for saving feedback
      setTimeout(() => setIsSaving(false), 500);
    });

    return () => subscription.unsubscribe();
  }, [form, isLoaded]);

  return (
    <div className="space-y-8">
       <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">
          Manage Global Content
        </h1>
        <p className="text-muted-foreground">
          Edit and save reusable content for your reports. Changes are saved automatically.
        </p>
      </header>

      <main>
        <Card>
          <CardHeader>
            <CardTitle>Report Content Blocks</CardTitle>
            <CardDescription>
              This content can be dynamically inserted into your report templates using the specified placeholders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-6">
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
                
                <div className="flex justify-end items-center h-10">
                  {isSaving && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </div>
                  )}
                   {!isSaving && isLoaded && (
                     <div className="flex items-center text-sm text-muted-foreground">
                        All changes saved.
                    </div>
                   )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
