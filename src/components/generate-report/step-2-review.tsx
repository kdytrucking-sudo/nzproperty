'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { listTemplates } from '@/ai/flows/list-templates';
import { generateReportFromTemplate } from '@/ai/flows/generate-report-from-template';
import type { PropertyData } from '@/lib/types';
import initialJsonStructure from '@/lib/json-structure.json';
import { getCommentaryOptions } from '@/ai/flows/get-commentary-options';
import type { CommentaryOptionsData } from '@/lib/commentary-schema';

const commentarySchema = z.object({
  PreviousSale: z.string().optional(),
  ContractSale: z.string().optional(),
  SuppliedDocumentation: z.string().optional(),
  RecentOrProvided: z.string().optional(),
  LIM: z.string().optional(),
  PC78: z.string().optional(),
  OperativeZone: z.string().optional(),
});

const formSchema = z.object({
  templateFileName: z.string().min(1, 'A report template is required.'),
  data: z.any(),
  commentary: commentarySchema,
});

type Step2ReviewProps = {
  extractedData: PropertyData;
  onReportGenerated: (reportDataUri: string, replacementsCount: number) => void;
  onBack: () => void;
};

const renderFormSection = (form: any, path: string, data: any, structure: any) => {
  if (typeof data !== 'object' || data === null || Array.isArray(data) || typeof structure !== 'object' || structure === null) {
    return null;
  }

  const keys = Object.keys(data);
  const textAreaFields = [
    'data.DIY.SWOT Analysis Strengths',
    'data.DIY.SWOT Analysis Weaknesses',
    'data.DIY.Location Description',
    'data.Property.Property Brief Description',
    'data.Property.Zoning',
    'data.Property.Title Interestes',
    'data.Valuation.Special Assumptions'
  ];

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
      {keys.map((key) => {
        // We handle 'Instructed By' manually below
        if (key === 'Instructed By' && path === 'data.Valuation') {
            return null;
        }

        const fieldPath = `${path}.${key}`;
        const structureValue = structure[key];
        const templateTag = (typeof structureValue === 'string' && structureValue.startsWith('[extracted_'))
          ? structureValue.replace('[extracted_', '[Replace_').replace(']', '')
          : null;
        const FormComponent = textAreaFields.includes(fieldPath) ? Textarea : Input;

        return (
          <FormField
            key={fieldPath}
            control={form.control}
            name={fieldPath}
            render={({ field }) => (
              <FormItem className={FormComponent === Textarea ? 'md:col-span-2' : ''}>
                <div className="flex items-center justify-between">
                  <FormLabel>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</FormLabel>
                  {templateTag && (
                    <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[{templateTag}]</code>
                  )}
                </div>
                <FormControl>
                  <FormComponent {...field} {...(FormComponent === Textarea ? { rows: 4 } : {})} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      })}
       {/* Manually add the "Instructed By" field to the Valuation tab */}
      {path === 'data.Valuation' && (
           <FormField
            control={form.control}
            name="data.Valuation.Instructed By"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Instructed By</FormLabel>
                  <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[Replace_InstructedBy]</code>
                </div>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
      )}
    </div>
  );
};

export function Step2Review({ extractedData, onReportGenerated, onBack }: Step2ReviewProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState<string[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [commentaryOptions, setCommentaryOptions] = React.useState<CommentaryOptionsData | null>(null);
  const [isLoadingInitialData, setIsLoadingInitialData] = React.useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateFileName: '',
      data: extractedData,
      commentary: {
        PreviousSale: '',
        ContractSale: '',
        SuppliedDocumentation: '',
        RecentOrProvided: '',
        LIM: '',
        PC78: '',
        OperativeZone: '',
      }
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'data.comparableSales',
  });

  React.useEffect(() => {
    async function fetchInitialData() {
      setIsLoadingInitialData(true);
      try {
        const [templateList, commentaryOpts] = await Promise.all([
          listTemplates(),
          getCommentaryOptions()
        ]);
        
        setTemplates(templateList);
        if (templateList.length > 0) {
          form.setValue('templateFileName', templateList[0]);
        }
        
        setCommentaryOptions(commentaryOpts);
        // Set default values for commentary radio groups
        form.setValue('commentary.PreviousSale', commentaryOpts.PreviousSale?.[0] || '');
        form.setValue('commentary.ContractSale', commentaryOpts.ContractSale?.[0] || '');
        form.setValue('commentary.SuppliedDocumentation', commentaryOpts.SuppliedDocumentation?.[0] || '');
        form.setValue('commentary.RecentOrProvided', commentaryOpts.RecentOrProvided?.[0] || '');
        form.setValue('commentary.LIM', commentaryOpts.LIM?.[0] || '');
        form.setValue('commentary.PC78', commentaryOpts.PC78?.[0] || '');
        form.setValue('commentary.OperativeZone', commentaryOpts.OperativeZone?.[0] || '');

      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Failed to load initial data', description: error.message });
      } finally {
        setIsLoadingInitialData(false);
      }
    }
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabKeys = Object.keys(initialJsonStructure);
  const defaultTab = tabKeys.length > 0 ? tabKeys[0] : 'comparableSales';

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsGenerating(true);

    if (!values.templateFileName) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a report template.' });
      setIsGenerating(false);
      return;
    }

    try {
      const fullData = { ...values.data, commentary: values.commentary };
      const result = await generateReportFromTemplate({
        templateFileName: values.templateFileName,
        data: fullData,
      });

      toast({
        title: 'Report Generated Successfully',
        description: `Replaced ${result.replacementsCount} placeholders. Your download will begin shortly.`,
      });
      onReportGenerated(result.generatedDocxDataUri, result.replacementsCount);

    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Report Generation Failed.',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsGenerating(false);
    }
  }

  const renderCommentarySection = () => {
    if (isLoadingInitialData) {
      return <div className="space-y-6 pt-4">
        <Skeleton className="h-8 w-1/4"/>
        <Skeleton className="h-20 w-full"/>
        <Skeleton className="h-8 w-1/4"/>
        <Skeleton className="h-20 w-full"/>
      </div>
    }
    if (!commentaryOptions) {
        return <div className="text-center py-10 text-muted-foreground">Could not load commentary options. Please define them in the 'Manage Commentary' page.</div>
    }
    
    const commentaryFields: { key: keyof CommentaryOptionsData, label: string, placeholder: string }[] = [
        { key: 'PreviousSale', label: 'Previous Sale', placeholder: 'Replace_PreviousSale' },
        { key: 'ContractSale', label: 'Contract for Sale', placeholder: 'Replace_ContractSale' },
        { key: 'SuppliedDocumentation', label: 'Supplied Documentation', placeholder: 'Replace_SuppliedDoc' },
        { key: 'RecentOrProvided', label: 'Recent/Provided', placeholder: 'Replace_RecentOrProvided' },
        { key: 'LIM', label: 'Land Information Memorandum', placeholder: 'Replace_LIM' },
        { key: 'PC78', label: 'Plan Change 78: Intensification', placeholder: 'Replace_PC78' },
        { key: 'OperativeZone', label: 'Operative Zone', placeholder: 'Replace_Zone' },
    ];

    return (
        <div className="space-y-6 pt-4">
          {commentaryFields.map(({ key, label, placeholder }) => {
            const options = commentaryOptions[key] || [];
            return (
              <FormField
                key={key}
                control={form.control}
                name={`commentary.${key}`}
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>{label} <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[{placeholder}]</code></FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2">
                        {options.length > 0 ? (
                           options.map((option, index) => (
                            <FormItem key={`${key}-${index}`} className="flex items-center space-x-3 space-y-0">
                              <FormControl><RadioGroupItem value={option} /></FormControl>
                              <FormLabel className="font-normal">{option}</FormLabel>
                            </FormItem>
                          ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No options defined for this category.</p>
                        )}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )
          })}
        </div>
      );
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
              name="templateFileName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Report Template</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a .docx template to use..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingInitialData ? (
                         <SelectItem value="loading" disabled>Loading templates...</SelectItem>
                      ) : templates.length === 0 ? (
                        <SelectItem value="no-templates" disabled>
                          No templates found. Upload in 'Manage Templates'.
                        </SelectItem>
                      ) : (
                        templates.map(templateName => (
                          <SelectItem key={templateName} value={templateName}>{templateName}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Tabs defaultValue={defaultTab}>
              <TabsList className="grid w-full grid-cols-1 md:grid-cols-5">
                {tabKeys.map(key => (
                  <TabsTrigger key={key} value={key}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </TabsTrigger>
                ))}
                {extractedData.comparableSales && <TabsTrigger value="comparableSales">Comparables</TabsTrigger>}
                <TabsTrigger value="commentary">Commentary</TabsTrigger>
              </TabsList>

              {tabKeys.map(key => (
                <TabsContent key={key} value={key} className="space-y-4 pt-4">
                  {renderFormSection(form, `data.${key}`, form.getValues(`data.${key}`), initialJsonStructure[key as keyof typeof initialJsonStructure])}
                </TabsContent>
              ))}

              {extractedData.comparableSales && (
                <TabsContent value="comparableSales" className="space-y-4 pt-4">
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
                          <span className="sr-only">Remove Comparable</span>
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ compAddress: '', compSaleDate: '', compSalePrice: '', compLandArea: '', compFloorArea: '' })}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Comparable Sale
                    </Button>
                  </div>
                </TabsContent>
              )}

              <TabsContent value="commentary">
                {renderCommentarySection()}
              </TabsContent>
            </Tabs>

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={onBack}>
                Back
              </Button>
              <Button type="submit" disabled={isGenerating || templates.length === 0}>
                {isGenerating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
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

    
