'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { PropertyData } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import * as React from 'react';
import { useTemplates } from '@/hooks/use-templates.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { generateReportFromTemplate } from '@/ai/flows/generate-report-from-template';

const comparableSaleSchema = z.object({
  compAddress: z.string().min(1, 'Address is required.'),
  compSaleDate: z.string().min(1, 'Sale date is required.'),
  compSalePrice: z.string().min(1, 'Sale price is required.'),
  compLandArea: z.string(),
  compFloorArea: z.string(),
});

const reportDataSchema = z.object({
  propertyDetails: z.object({
    address: z.string().min(1, 'Address is required.'),
    legalDescription: z.string(),
    ownerName: z.string(),
    landArea: z.string(),
    floorArea: z.string(),
    currentCV: z.string(),
    lastSaleDate: z.string(),
    lastSalePrice: z.string(),
    zoning: z.string(),
    propertyType: z.string(),
  }),
  valuationSummary: z.object({
    valuationDate: z.string(),
    marketValue: z.string(),
    methodologyUsed: z.string(),
    keyAssumptions: z.string(),
  }),
  comparableSales: z.array(comparableSaleSchema),
  risksAndOpportunities: z.string(),
  additionalNotes: z.string(),
});

const formSchema = z.object({
    templateId: z.string().min(1, 'A template is required.'),
    data: reportDataSchema,
})

type Step2ReviewProps = {
  extractedData: PropertyData;
  onReportGenerated: (reportDataUri: string) => void;
  onBack: () => void;
};

export function Step2Review({ extractedData, onReportGenerated, onBack }: Step2ReviewProps) {
  const { toast } = useToast();
  const { templates } = useTemplates();
  const [isGenerating, setIsGenerating] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        templateId: templates.length > 0 ? templates[0].id : '',
        data: extractedData,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'data.comparableSales',
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsGenerating(true);
    
    const selectedTemplate = templates.find(t => t.id === values.templateId);
    if (!selectedTemplate) {
        toast({ variant: 'destructive', title: 'Error', description: 'Selected template not found.' });
        setIsGenerating(false);
        return;
    }

    try {
        const result = await generateReportFromTemplate({
            templateDataUri: selectedTemplate.dataUri,
            data: values.data,
        });

        toast({
            title: 'Report Generated Successfully',
            description: 'Your property valuation report is ready for download.',
        });
        onReportGenerated(result.generatedDocxDataUri);

    } catch (error) {
        console.error('Error generating report:', error);
        toast({
            variant: 'destructive',
            title: 'Uh oh! Something went wrong.',
            description: 'There was a problem generating your report. Please try again.',
        });
    } finally {
        setIsGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Review & Edit Extracted Data</CardTitle>
        <CardDescription>
          Review the data, make corrections, and select a template to generate the final report.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Report Template</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a .docx template to use..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {templates.length === 0 ? (
                        <SelectItem value="no-templates" disabled>No templates uploaded yet</SelectItem>
                      ) : (
                        templates.map(template => (
                          <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Tabs defaultValue="property-details">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="property-details">Property Details</TabsTrigger>
                <TabsTrigger value="valuation-summary">Valuation</TabsTrigger>
                <TabsTrigger value="comparables">Comparables</TabsTrigger>
              </TabsList>

              <TabsContent value="property-details" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {Object.keys(form.getValues('data.propertyDetails')).map((key) => (
                    <FormField
                      key={key}
                      control={form.control}
                      name={`data.propertyDetails.${key as keyof PropertyData['propertyDetails']}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="valuation-summary" className="space-y-4 pt-4">
                 <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {Object.keys(form.getValues('data.valuationSummary')).map((key) => (
                    <FormField
                      key={key}
                      control={form.control}
                      name={`data.valuationSummary.${key as keyof PropertyData['valuationSummary']}`}
                      render={({ field }) => (
                        <FormItem className={key === 'keyAssumptions' ? 'md:col-span-2' : ''}>
                          <FormLabel>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</FormLabel>
                          <FormControl>
                            {key === 'keyAssumptions' ? <Textarea {...field} rows={4} /> : <Input {...field} />}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormField
                  control={form.control}
                  name="data.risksAndOpportunities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Risks and Opportunities</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="data.additionalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="comparables" className="space-y-4 pt-4">
                <div className="space-y-6">
                  {fields.map((field, index) => (
                    <div key={field.id} className="relative rounded-md border p-4 pr-12">
                       <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                        <FormField control={form.control} name={`data.comparableSales.${index}.compAddress`} render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`data.comparableSales.${index}.compSaleDate`} render={({ field }) => (<FormItem><FormLabel>Sale Date</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`data.comparableSales.${index}.compSalePrice`} render={({ field }) => (<FormItem><FormLabel>Sale Price</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`data.comparableSales.${index}.compLandArea`} render={({ field }) => (<FormItem><FormLabel>Land Area</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`data.comparableSales.${index}.compFloorArea`} render={({ field }) => (<FormItem><FormLabel>Floor Area</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <Button type="button" variant="destructive" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ compAddress: '', compSaleDate: '', compSalePrice: '', compLandArea: '', compFloorArea: '' })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Comparable Sale
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={onBack}>
                Back
              </Button>
              <Button type="submit" disabled={isGenerating || templates.length === 0}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  'Generate Final Report'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
