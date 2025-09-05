
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
import { Checkbox } from '@/components/ui/checkbox';

const commentarySchema = z.object({
  PreviousSale: z.string().optional(),
  ContractSale: z.string().optional(),
  Disclosure: z.string().optional(),
  MarketComment: z.string().optional(),
  SuppliedDocumentation: z.string().optional(),
  RecentOrProvided: z.string().optional(),
  LIM: z.string().optional(),
  PC78: z.string().optional(),
  OperativeZone: z.string().optional(),
  ZoningOperative: z.string().optional(),
  ZoningPlanChange78: z.string().optional(),
});

const constructionBriefSchema = z.object({
    generalConstruction: z.array(z.string()),
    interior: z.array(z.string()),
    finalBrief: z.string(),
});

const formSchema = z.object({
  templateFileName: z.string().min(1, 'A report template is required.'),
  data: z.any(),
  commentary: commentarySchema,
  constructionBrief: constructionBriefSchema,
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
    'data.Valuation.Special Assumptions',
    'data.Property.Title Brief',
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
        Disclosure: '',
        MarketComment: '',
        SuppliedDocumentation: '',
        RecentOrProvided: '',
        LIM: '',
        PC78: '',
        OperativeZone: '',
        ZoningOperative: '',
        ZoningPlanChange78: '',
      },
      constructionBrief: {
        generalConstruction: [],
        interior: [],
        finalBrief: '',
      }
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'data.comparableSales',
  });

  const generalConstructionOptions = [
    { id: 'concrete slab foundation', label: 'concrete slab foundation' },
    { id: 'pile foundation', label: 'pile foundation' },
    { id: 'concrete ring wall', label: 'concrete ring wall' },
    { id: 'concrete flooring', label: 'concrete flooring' },
    { id: 'timber flooring', label: 'timber flooring' },
    { id: 'brick cladding', label: 'brick cladding' },
    { id: 'timber weatherboard cladding', label: 'timber weatherboard cladding' },
    { id: 'vertical timber cladding', label: 'vertical timber cladding' },
    { id: 'horizontal timber cladding', label: 'horizontal timber cladding' },
    { id: 'plaster cladding', label: 'plaster cladding' },
    { id: 'concrete cladding', label: 'concrete cladding' },
    { id: 'fibre cement sheet cladding', label: 'fibre cement sheet cladding' },
    { id: 'tile cladding', label: 'tile cladding' },
    { id: 'steel cladding', label: 'steel cladding' },
    { id: 'concrete block cladding', label: 'concrete block cladding' },
    { id: 'aluminium joinery', label: 'aluminium joinery' },
    { id: 'double glazed aluminium joinery', label: 'double glazed aluminium joinery' },
    { id: 'timber joinery', label: 'timber joinery' },
    { id: 'metal roof', label: 'metal roof' },
    { id: 'tile roof', label: 'tile roof' },
    { id: 'longrun steel roof', label: 'longrun steel roof' },
    { id: 'concrete tile roof', label: 'concrete tile roof' },
    { id: 'metal tile roof', label: 'metal tile roof' },
  ];

  const interiorOptions = [
      { id: 'plasterboard', label: 'plasterboard' },
      { id: 'soft board', label: 'soft board' },
      { id: 'hard board', label: 'hard board' },
      { id: 'tile ceiling', label: 'tile ceiling' },
      { id: 'plaster ceiling', label: 'plaster ceiling' },
  ];

  const generateBrief = () => {
      const { generalConstruction, interior } = form.getValues('constructionBrief');

      let firstSentence = 'General construction elements comprise what appears to be ';
      if (generalConstruction.length > 0) {
          if (generalConstruction.length === 1) {
              firstSentence += generalConstruction[0] + '.';
          } else {
              const allButLast = generalConstruction.slice(0, -1).join(', ');
              const last = generalConstruction[generalConstruction.length - 1];
              firstSentence += `${allButLast} and ${last}.`;
          }
      }

      let secondSentence = 'The interior appears to be mostly timber framed with ';
      if (interior.length > 0) {
          if (interior.length === 1) {
               secondSentence += interior[0];
          } else {
              const allButLast = interior.slice(0, -1).join(', ');
              const last = interior[interior.length - 1];
              secondSentence += `${allButLast} and ${last}`;
          }
      }
      secondSentence += ' or of similar linings.';

      const fullBrief = `${firstSentence}\n${secondSentence}`;
      form.setValue('constructionBrief.finalBrief', fullBrief);
  };


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
        // Set default values for commentary textareas
        form.setValue('commentary.PreviousSale', commentaryOpts.PreviousSale?.[0] || '');
        form.setValue('commentary.ContractSale', commentaryOpts.ContractSale?.[0] || '');
        form.setValue('commentary.Disclosure', commentaryOpts.Disclosure?.[0] || '');
        form.setValue('commentary.MarketComment', commentaryOpts.MarketComment?.[0] || '');
        form.setValue('commentary.SuppliedDocumentation', commentaryOpts.SuppliedDocumentation?.[0] || '');
        form.setValue('commentary.RecentOrProvided', commentaryOpts.RecentOrProvided?.[0] || '');
        form.setValue('commentary.LIM', commentaryOpts.LIM?.[0] || '');
        form.setValue('commentary.PC78', commentaryOpts.PC78?.[0] || '');
        form.setValue('commentary.OperativeZone', commentaryOpts.OperativeZone?.[0] || '');
        form.setValue('commentary.ZoningOperative', commentaryOpts.ZoningOperative?.[0] || '');
        form.setValue('commentary.ZoningPlanChange78', commentaryOpts.ZoningPlanChange78?.[0] || '');

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
      const fullData = { ...values.data, commentary: values.commentary, constructionBrief: values.constructionBrief };
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
    
    const commentaryFields: { key: keyof CommentaryOptionsData, label: string, placeholder?: string }[] = [
        { key: 'PreviousSale', label: 'Previous Sale', placeholder: 'Replace_PreviousSale' },
        { key: 'ContractSale', label: 'Contract for Sale', placeholder: 'Replace_ContractSale' },
        { key: 'Disclosure', label: 'Disclosure' },
        { key: 'MarketComment', label: 'Market Comment' },
        { key: 'SuppliedDocumentation', label: 'Supplied Documentation', placeholder: 'Replace_SuppliedDoc' },
        { key: 'RecentOrProvided', label: 'Recent/Provided', placeholder: 'Replace_RecentOrProvided' },
        { key: 'LIM', label: 'Land Information Memorandum', placeholder: 'Replace_LIM' },
        { key: 'PC78', label: 'Plan Change 78: Intensification', placeholder: 'Replace_PC78' },
        { key: 'OperativeZone', label: 'Operative Zone', placeholder: 'Replace_Zone' },
        { key: 'ZoningOperative', label: 'Zoning Operative', placeholder: 'Replace_ZoningOperative' },
        { key: 'ZoningPlanChange78', label: 'Zoning Plan Change 78', placeholder: 'Replace_ZoningPlanChange78' },
    ];

    return (
      <div className="space-y-6 pt-4">
        {commentaryFields.map(({ key, label, placeholder }) => {
          const options = commentaryOptions[key] || [];
          // Skip rendering if the key doesn't exist in commentaryOptions, it means it's not a valid key from the schema.
          if (!commentaryOptions.hasOwnProperty(key)) {
            return null;
          }
          return (
            <div key={key} className="space-y-4 rounded-md border p-4">
              <h3 className="font-medium">{label} {placeholder && <code className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[{placeholder}]</code>}</h3>
              
              {options.length > 0 ? (
                <RadioGroup
                  onValueChange={(value) => form.setValue(`commentary.${key}`, value)}
                  defaultValue={form.getValues(`commentary.${key}`) || options[0]}
                  className="flex flex-col space-y-2"
                >
                  {options.map((option, index) => (
                    <FormItem key={`${key}-${index}`} className="flex items-center space-x-3 space-y-0">
                      <FormControl><RadioGroupItem value={option} /></FormControl>
                      <FormLabel className="font-normal">{option.length > 100 ? `${option.substring(0, 100)}...` : option}</FormLabel>
                    </FormItem>
                  ))}
                </RadioGroup>
              ) : (
                <p className="text-sm text-muted-foreground">No options defined for this category.</p>
              )}

              <FormField
                control={form.control}
                name={`commentary.${key}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Editable Commentary</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={6} className="mt-4 font-mono text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )
        })}
      </div>
    );
  }

  const renderConstructionBriefSection = () => {
    return (
        <div className="space-y-8 pt-4">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>General Construction Elements</CardTitle>
                        <CardDescription>Select the elements for the first sentence.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <FormField
                            control={form.control}
                            name="constructionBrief.generalConstruction"
                            render={() => (
                                <div className="grid grid-cols-2 gap-4">
                                    {generalConstructionOptions.map((item) => (
                                        <FormField
                                            key={item.id}
                                            control={form.control}
                                            name="constructionBrief.generalConstruction"
                                            render={({ field }) => (
                                                <FormItem
                                                    key={item.id}
                                                    className="flex flex-row items-start space-x-3 space-y-0"
                                                >
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value?.includes(item.id)}
                                                            onCheckedChange={(checked) => {
                                                                return checked
                                                                    ? field.onChange([...(field.value || []), item.id])
                                                                    : field.onChange(
                                                                        field.value?.filter(
                                                                            (value) => value !== item.id
                                                                        )
                                                                    )
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">
                                                        {item.label}
                                                    </FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Interior Elements</CardTitle>
                        <CardDescription>Select the elements for the second sentence.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                         <FormField
                            control={form.control}
                            name="constructionBrief.interior"
                            render={() => (
                                <div className="grid grid-cols-2 gap-4">
                                    {interiorOptions.map((item) => (
                                        <FormField
                                            key={item.id}
                                            control={form.control}
                                            name="constructionBrief.interior"
                                            render={({ field }) => (
                                                <FormItem
                                                    key={item.id}
                                                    className="flex flex-row items-start space-x-3 space-y-0"
                                                >
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value?.includes(item.id)}
                                                            onCheckedChange={(checked) => {
                                                                return checked
                                                                    ? field.onChange([...(field.value || []), item.id])
                                                                    : field.onChange(
                                                                        field.value?.filter(
                                                                            (value) => value !== item.id
                                                                        )
                                                                    )
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">
                                                        {item.label}
                                                    </FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            )}
                        />
                    </CardContent>
                </Card>
            </div>
            
            <div className="flex justify-center">
                <Button type="button" onClick={generateBrief}>
                    Generate Brief
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Generated Construction Brief</CardTitle>
                    <CardDescription>Review and edit the generated text below. This content will be used for the [Replace_ConstructionBrief] placeholder.</CardDescription>
                </CardHeader>
                <CardContent>
                    <FormField
                        control={form.control}
                        name="constructionBrief.finalBrief"
                        render={({ field }) => (
                            <Textarea {...field} rows={8} className="font-mono"/>
                        )}
                    />
                </CardContent>
            </Card>
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
              <TabsList className="grid w-full grid-cols-1 md:grid-cols-6">
                {tabKeys.map(key => (
                  <TabsTrigger key={key} value={key}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </TabsTrigger>
                ))}
                {extractedData.comparableSales && <TabsTrigger value="comparableSales">Comparables</TabsTrigger>}
                <TabsTrigger value="commentary">Commentary</TabsTrigger>
                <TabsTrigger value="constructionBrief">Construction Brief</TabsTrigger>
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
              <TabsContent value="constructionBrief">
                {renderConstructionBriefSection()}
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

    
