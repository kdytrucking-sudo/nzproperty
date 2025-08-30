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

const formSchema = z.object({
  economicUpdate: z.string(),
  marketTrends: z.string(),
  regionalAnalysis: z.string(),
  legalDisclaimer: z.string(),
  companyBoilerplate: z.string(),
});

const contentFields = [
    { name: "economicUpdate", label: "Economic Dynamics", placeholder: "Enter the latest economic updates relevant to the property market..." },
    { name: "marketTrends", label: "Market Trends", placeholder: "Describe current market trends, such as price movements, demand, and supply..." },
    { name: "regionalAnalysis", label: "Regional Analysis", placeholder: "Provide analysis on the specific region of the property..." },
    { name: "legalDisclaimer", label: "Legal Disclaimer", placeholder: "Enter the standard legal disclaimer for valuation reports..." },
    { name: "companyBoilerplate", label: "Company Boilerplate", placeholder: "Enter your company's standard information or about section..." },
] as const;


export default function ManageContentPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    // In a real app, you would fetch these default values from a database (e.g., Firestore)
    defaultValues: {
      economicUpdate: '',
      marketTrends: '',
      regionalAnalysis: '',
      legalDisclaimer: '',
      companyBoilerplate: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    console.log('Saving content:', values);

    // Simulate saving to a database
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({
      title: 'Content Saved',
      description: 'Your changes have been successfully saved.',
    });
    setIsSaving(false);
  }

  return (
    <div className="space-y-8">
       <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">
          Manage Content
        </h1>
        <p className="text-muted-foreground">
          Edit and save regularly updated content for your reports.
        </p>
      </header>

      <main>
        <Card>
          <CardHeader>
            <CardTitle>Report Content Blocks</CardTitle>
            <CardDescription>
              This content can be dynamically inserted into your report templates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {contentFields.map((item) => (
                    <FormField
                    key={item.name}
                    control={form.control}
                    name={item.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{item.label}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={item.placeholder}
                            className="min-h-[120px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
