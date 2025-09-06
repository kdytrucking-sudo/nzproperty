'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlusCircle, Trash2, Copy } from 'lucide-react';
import { useForm, useFieldArray, Control, FieldValues, Path } from 'react-hook-form';
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
import { getCommentaryOptions } from '@/ai/flows/get-commentary-options';
import type { CommentaryOptionsData } from '@/lib/commentary-schema';
import { Checkbox } from '@/components/ui/checkbox';
import { convertNumberToWords } from '@/ai/flows/convert-number-to-words';
import { Separator } from '@/components/ui/separator';
import { getExtractionConfig } from '@/ai/flows/get-extraction-config';

// Main form schema
const formSchema = z.any();

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
  
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
      {keys.map((key) => {
        const fieldPath = `${path}.${key}`;
        const fieldConfig = structure[key];
        
        if (!fieldConfig || typeof fieldConfig !== 'object') {
          return null; // Skip if no config
        }
        
        const { label, placeholder, displayType } = fieldConfig;
        
        const templateTag = placeholder
          ? placeholder.replace(/\[(extracted_|Replace_)\s*/, '[Replace_').replace(']', '')
          : null;

        const FormComponent = displayType === 'textarea' ? Textarea : Input;

        return (
          <FormField
            key={fieldPath}
            control={form.control}
            name={fieldPath}
            render={({ field }) => (
              <FormItem className={FormComponent === Textarea ? 'md:col-span-2' : ''}>
                <div className="flex items-center justify-between">
                  <FormLabel>{label || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</FormLabel>
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
  const [commentaryOptions, setCommentaryOptions] = React.useState<CommentaryOptionsData | null>(null);
  const [isLoadingInitialData, setIsLoadingInitialData] = React.useState(true);
  const [isConvertingToWords, setIsConvertingToWords] = React.useState(false);
  const [valuationCheckStatus, setValuationCheckStatus] = React.useState<'Equal' | 'Error' | null>(null);
  const [jsonStructure, setJsonStructure] = React.useState<any>(null);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateFileName: '',
      data: extractedData,
      commentary: {
        PurposeofValuation: '',
        PreviousSale: '',
        ContractSale: '',
        SuppliedDocumentation: '',
        RecentOrProvided: '',
        LIM: '',
        PC78: '',
        OperativeZone: '',
      },
      constructionBrief: {
        generalConstruction: [],
        interior: [],
        finalBrief: '',
      },
      marketValuation: {
        marketValue: '',
        marketValuation: '',
        improvementsValueByValuer: '',
        landValueByValuer: '',
        chattelsValueByValuer: '',
        marketValueByValuer: '',
      },
      statutoryValuation: {
        landValueByWeb: '',
        improvementsValueByWeb: '',
        ratingValueByWeb: '',
      },
      marketValuationRaw: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'data.comparableSales',
  });
  
  const parseCurrency = (value: string | undefined): number => {
    if (!value) return 0;
    return Number(String(value).replace(/[^0-9.-]+/g,""));
  };
  
  const formatCurrency = (value: number | undefined): string => {
    if (value === undefined || isNaN(value)) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };
  
  const handleMarketValuationUpdate = React.useCallback(async () => {
    const rawValue = form.getValues('marketValuationRaw');
    if (!rawValue) {
        toast({ variant: 'destructive', title: 'Input Required', description: 'Please enter a numeric value for Market Valuation.' });
        return;
    }
    const numericValue = parseCurrency(rawValue);
    if (isNaN(numericValue)) {
        toast({ variant: 'destructive', title: 'Invalid Input', description: 'Market Valuation must be a number.' });
        return;
    }

    const formattedMarketValue = formatCurrency(numericValue);
    form.setValue('marketValuation.marketValue', formattedMarketValue);

    setIsConvertingToWords(true);
    try {
      const result = await convertNumberToWords({ number: numericValue });
      const valuationNarrative = `${formattedMarketValue}\n${result.words}`;
      form.setValue('marketValuation.marketValuation', valuationNarrative);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Conversion Failed', description: error.message });
      form.setValue('marketValuation.marketValuation', formattedMarketValue);
    } finally {
      setIsConvertingToWords(false);
    }
  }, [form, toast]);


  const handleSumAndCheck = () => {
    const improvementsValue = parseCurrency(form.getValues('marketValuation.improvementsValueByValuer'));
    const landValue = parseCurrency(form.getValues('marketValuation.landValueByValuer'));
    const chattelsValue = parseCurrency(form.getValues('marketValuation.chattelsValueByValuer'));

    const total = improvementsValue + landValue + chattelsValue;

    form.setValue('marketValuation.improvementsValueByValuer', formatCurrency(improvementsValue));
    form.setValue('marketValuation.landValueByValuer', formatCurrency(landValue));
    form.setValue('marketValuation.chattelsValueByValuer', formatCurrency(chattelsValue));
    form.setValue('marketValuation.marketValueByValuer', formatCurrency(total));
    
    const marketValueFromFirstCard = parseCurrency(form.getValues('marketValuation.marketValue'));

    if(total === marketValueFromFirstCard) {
        setValuationCheckStatus('Equal');
    } else {
        setValuationCheckStatus('Error');
    }
  };

  const handleStatutoryCalculation = () => {
    const landValue = parseCurrency(form.getValues('statutoryValuation.landValueByWeb'));
    const improvementsValue = parseCurrency(form.getValues('statutoryValuation.improvementsValueByWeb'));

    const total = landValue + improvementsValue;
    
    form.setValue('statutoryValuation.landValueByWeb', formatCurrency(landValue));
    form.setValue('statutoryValuation.improvementsValueByWeb', formatCurrency(improvementsValue));
    form.setValue('statutoryValuation.ratingValueByWeb', formatCurrency(total));
  };


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
        const [templateList, commentaryOpts, config] = await Promise.all([
          listTemplates(),
          getCommentaryOptions(),
          getExtractionConfig()
        ]);
        
        const loadedJsonStructure = JSON.parse(config.jsonStructure);
        setJsonStructure(loadedJsonStructure);

        setTemplates(templateList);
        if (templateList.length > 0) {
          form.setValue('templateFileName', templateList[0]);
        }
        
        setCommentaryOptions(commentaryOpts);
        // Set default values for commentary textareas
        form.setValue('commentary.PurposeofValuation', commentaryOpts.PurposeofValuation?.[0] || '');
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

  const tabKeys = jsonStructure ? Object.keys(jsonStructure) : [];
  const defaultTab = tabKeys.length > 0 ? tabKeys[0] : 'marketValuation';

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsGenerating(true);

    if (!values.templateFileName) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a report template.' });
      setIsGenerating(false);
      return;
    }

    try {
      const fullData = { 
        ...values.data, 
        commentary: values.commentary, 
        constructionBrief: values.constructionBrief, 
        marketValuation: values.marketValuation,
        statutoryValuation: values.statutoryValuation,
      };
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
        return <div className="text-center py-10 text-muted-foreground">Loading Commentary Options...</div>
    }
    if (!commentaryOptions) {
        return <div className="text-center py-10 text-muted-foreground">Could not load commentary options. Please define them in the 'Manage Commentary' page.</div>
    }
    
    const commentaryFields: { key: keyof CommentaryOptionsData, label: string, placeholder?: string }[] = [
        { key: 'PurposeofValuation', label: 'Purpose of Valuation', placeholder: '[Replace_PurposeofValuation]' },
        { key: 'PreviousSale', label: 'Previous Sale', placeholder: '[Replace_PreviousSale]' },
        { key: 'ContractSale', label: 'Contract for Sale', placeholder: '[Replace_ContractSale]' },
        { key: 'SuppliedDocumentation', label: 'Supplied Documentation', placeholder: '[Replace_SuppliedDoc]' },
        { key: 'RecentOrProvided', label: 'Recent/Provided', placeholder: '[Replace_RecentOrProvided]' },
        { key: 'LIM', label: 'Land Information Memorandum', placeholder: '[Replace_LIM]' },
        { key: 'PC78', label: 'Plan Change 78: Intensification', placeholder: '[Replace_PC78]' },
        { key: 'OperativeZone', label: 'Operative Zone', placeholder: '[Replace_Zone]' },
    ];

    return (
      <div className="space-y-6 pt-4">
        {commentaryFields.map(({ key, label, placeholder }) => {
          const options = commentaryOptions[key as keyof CommentaryOptionsData] || [];
          // Skip rendering if the key doesn't exist in commentaryOptions
          if (!commentaryOptions.hasOwnProperty(key)) {
            return null;
          }
          return (
            <div key={key} className="space-y-4 rounded-md border p-4">
              <h3 className="font-medium">{label} {placeholder && <code className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">{placeholder}</code>}</h3>
              <FormField
                control={form.control}
                name={`commentary.${key}`}
                render={({ field }) => (
                  <>
                    {options.length > 0 ? (
                      <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
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
                    <FormItem className="mt-4">
                        <FormLabel className="sr-only">Editable Commentary for {label}</FormLabel>
                        <FormControl>
                            <Textarea {...field} rows={6} className="font-mono text-sm" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                  </>
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
  };
  
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied!', description: 'Address copied to clipboard.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to copy', description: 'Could not copy address.' });
    }
  };

  const renderMarketValuationSection = () => {
    return (
      <div className="space-y-6 pt-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Market Valuation</CardTitle>
            <CardDescription>
              Enter the total market value to generate the formatted currency and text representations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="marketValuationRaw"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Input Value</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input 
                            placeholder="e.g., 940000" 
                            {...field} />
                        </FormControl>
                        <Button type="button" onClick={handleMarketValuationUpdate} disabled={isConvertingToWords}>
                          {isConvertingToWords ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="marketValuation.marketValue"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Market Value</FormLabel>
                        <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[Replace_MarketValue]</code>
                      </div>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <FormField
              control={form.control}
              name="marketValuation.marketValuation"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Market Valuation (Narrative)</FormLabel>
                    <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[Replace_MarketValuation]</code>
                  </div>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Valuation Breakdown</CardTitle>
                <CardDescription>Enter the breakdown and check the sum against the market value.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="marketValuation.improvementsValueByValuer"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                    <FormLabel>Improvements Value</FormLabel>
                                    <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[Replace_ImprovementValueByValuer]</code>
                                </div>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="marketValuation.landValueByValuer"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                    <FormLabel>Land Value</FormLabel>
                                    <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[Replace_LandValueByValuer]</code>
                                </div>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="marketValuation.chattelsValueByValuer"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                    <FormLabel>Chattels</FormLabel>
                                    <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[Replace_ChattelsByValuer]</code>
                                </div>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2">
                        <FormField
                            control={form.control}
                            name="marketValuation.marketValueByValuer"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center justify-between">
                                        <FormLabel>Market Value</FormLabel>
                                        <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[Replace_MarketValueByValuer]</code>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <FormControl><Input {...field} /></FormControl>
                                        {valuationCheckStatus === 'Equal' && <span className="text-sm font-medium text-green-600">Equal</span>}
                                        {valuationCheckStatus === 'Error' && <span className="text-sm font-medium text-destructive">Error</span>}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <Button type="button" onClick={handleSumAndCheck}>Sum & Check</Button>
                </div>
            </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Statutory Valuation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-md border bg-muted/50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Property Address: <span className="text-foreground">{extractedData.Info?.['Property Address'] || 'N/A'}</span></p>
                <Button variant="ghost" size="sm" onClick={() => handleCopy(extractedData.Info?.['Property Address'] || '')}><Copy className="mr-2 h-4 w-4" />Copy</Button>
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                URL: <a href="https://www.aucklandcouncil.govt.nz/property-rates-valuations/pages/find-property-rates-valuation.aspx" target="_blank" rel="noopener noreferrer" className="text-primary underline">click to open official site</a>
              </p>
            </div>
            <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
                <FormField
                    control={form.control}
                    name="statutoryValuation.landValueByWeb"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Land Value</FormLabel><code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[Replace_LandValueFromWeb]</code></div>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="statutoryValuation.improvementsValueByWeb"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Value of Improvements</FormLabel><code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[Replace_ValueofImprovementsFromWeb]</code></div>
                             <div className="flex items-center gap-2">
                                <FormControl><Input {...field} /></FormControl>
                                <Button type="button" variant="secondary" size="sm" onClick={handleStatutoryCalculation}>Cal</Button>
                             </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="statutoryValuation.ratingValueByWeb"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Rating Valuation</FormLabel><code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">[Replace_RatingValuationFromWeb]</code></div>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
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
            {isLoadingInitialData ? (
                <div className="space-y-6">
                    <Skeleton className="h-10 w-1/3" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            ) : (
                <>
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
                    <TabsList className="grid w-full grid-cols-1 md:grid-cols-6">
                        {tabKeys.map(key => (
                        <TabsTrigger key={key} value={key}>
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </TabsTrigger>
                        ))}
                        <TabsTrigger value="marketValuation">Market Valuation</TabsTrigger>
                        <TabsTrigger value="commentary">Commentary</TabsTrigger>
                        <TabsTrigger value="constructionBrief">Construction Brief</TabsTrigger>
                    </TabsList>

                    {tabKeys.map(key => (
                        <TabsContent key={key} value={key} className="space-y-4 pt-4">
                        {renderFormSection(form, `data.${key}`, form.getValues(`data.${key}`), jsonStructure?.[key])}
                        </TabsContent>
                    ))}
                    
                    <TabsContent value="marketValuation">
                        {renderMarketValuationSection()}
                    </TabsContent>
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
                </>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
