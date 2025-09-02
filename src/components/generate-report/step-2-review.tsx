
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
import { listTemplates } from '@/ai/flows/list-templates';
import { generateReportFromTemplate } from '@/ai/flows/generate-report-from-template';
import type { PropertyData } from '@/lib/types';
import initialJsonStructure from '@/lib/json-structure.json';

// Define commentary options as a module-level constant to prevent re-declaration on render.
const commentaryOptions = {
    PreviousSale: [
        { id: 'ps1', label: 'There are no sales listed for the property within the last three years.' },
        { id: 'ps2', label: 'Last sold in ... for $.... Comment on relevance of the previous sale price.' },
    ],
    ContractSale: [
        { id: 'cs1', label: 'To the best of our knowledge, we are not aware of any current contract for sale on the property.' },
        { id: 'cs2', label: "Property is currently listed OR aware of sale don't know price OR aware, price is ......." },
        { id: 'cs3', label: 'Have viewed S&P – no unusual or onerous clauses.' },
    ],
    Disclosure: [
        { id: 'd1', label: 'We have not been provided with a pre-contract disclosure statement, we assume one will be made available prior to any sale and that it will not contain any adverse information that will affect the value of the property.' },
        { id: 'd2_unique', label: 'We have been provided with a pre-contract disclosure statement which we have reviewed and note that it does not appear to contain any adverse information that would affect the value of the property.' },
    ],
    MarketComment: [
        { id: 'mc1', label: 'The housing market outlook remains mixed, with cautious optimism driven by increased mortgage pre-approvals and improving auction clearance rates. Expected OCR cuts may boost buyer eligibility, while investors benefit from tax reforms and equity growth. However, rising unemployment poses a risk, potentially leading to more forced sales. House prices are projected to grow moderately, contingent on stable employment and controlled construction costs. As such, a moderate level of risk remains.' },
    ]
};

// Define Zod schemas for the form
const commentarySchema = z.object({
    PreviousSale: z.string().optional(),
    ContractSale: z.string().optional(),
    Disclosure: z.string().optional(),
    MarketComment: z.string().optional(),
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

// Helper to render form fields for a given section
const renderFormSection = (form: any, path: string, data: any, structure: any) => {
    if (typeof data !== 'object' || data === null || Array.isArray(data) || typeof structure !== 'object' || structure === null) {
        return null;
    }

    const keys = Object.keys(data);
    const textAreaFields = [
      'data.DIY.SWOT Analysis Strengths',
      'data.DIY.SWOT Analysis Weaknesses',
      'data.DIY.Location Description',
      'data.Property.Property Brief Description'
    ];

    return (
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
            {keys.map((key) => {
                const fieldPath = `${path}.${key}`;
                const structureValue = structure[key];
                const templateTag = (typeof structureValue === 'string' && structureValue.startsWith('[extracted_')) 
                    ? structureValue.replace('[extracted_', '[Replace_') 
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
                                       <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">{templateTag}</code>
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
        </div>
    );
};

export function Step2Review({ extractedData, onReportGenerated, onBack }: Step2ReviewProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState<string[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateFileName: '',
      data: extractedData,
      commentary: {
        PreviousSale: commentaryOptions.PreviousSale[0].label,
        ContractSale: commentaryOptions.ContractSale[0].label,
        Disclosure: commentaryOptions.Disclosure[0].label,
        MarketComment: commentaryOptions.MarketComment[0].label,
      }
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'data.comparableSales',
  });

  React.useEffect(() => {
    async function fetchTemplates() {
        try {
            const templateList = await listTemplates();
            setTemplates(templateList);
            if (templateList.length > 0) {
                form.setValue('templateFileName', templateList[0]);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to load templates', description: error.message });
        }
    }
    fetchTemplates();
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
                      {templates.length === 0 ? (
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
                                <FormField control={form.control} name={`data.comparableSales.${index}.compFloorArea`} render={({ field }) => (<FormItem><FormLabel>Floor Area</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormMessage /></FormItem>)} />
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

              <TabsContent value="commentary" className="space-y-6 pt-4">
                {Object.entries(commentaryOptions).map(([key, options]) => (
                     <FormField
                        key={key}
                        control={form.control}
                        name={`commentary.${key as keyof typeof commentaryOptions}`}
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel>{key.replace(/([A-Z])/g, ' $1').trim()} <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[Replace_{key}]</code></FormLabel>
                                <FormControl>
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-2">
                                        {options.map(option => (
                                            <FormItem key={option.id} className="flex items-center space-x-3 space-y-0">
                                                <FormControl><RadioGroupItem value={option.label} /></FormControl>
                                                <FormLabel className="font-normal">{option.label}</FormLabel>
                                            </FormItem>
                                        ))}
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ))}
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

    