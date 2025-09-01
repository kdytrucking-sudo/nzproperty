'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlusCircle, Trash2, Upload } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import { useTemplates, type Template } from '@/hooks/use-templates.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { generateReportFromTemplate } from '@/ai/flows/generate-report-from-template';

// Zod schema for a single comparable sale
const comparableSaleSchema = z.object({
  compAddress: z.string().min(1, 'Address is required.'),
  compSaleDate: z.string().min(1, 'Sale date is required.'),
  compSalePrice: z.string().min(1, 'Sale price is required.'),
  compLandArea: z.string(),
  compFloorArea: z.string(),
});

// A flexible schema that can handle any object shape.
const anyObject = z.record(z.string(), z.any());

// The main form schema
const formSchema = z.object({
  templateId: z.string().min(1, 'A template is required.'),
  data: z.any(), // We use z.any() because the structure is now fully dynamic.
});

type Step2ReviewProps = {
  extractedData: PropertyData;
  onReportGenerated: (reportDataUri: string) => void;
  onBack: () => void;
};

// Helper to render form fields for a given object in the data
const renderFormSection = (form: any, path: string, data: any) => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }

  const keys = Object.keys(data);
  const isGrid = keys.length > 2;

  return (
    <div className={isGrid ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "space-y-4"}>
      {keys.map((key) => {
        const fieldPath = `${path}.${key}`;
        const isTextArea = typeof data[key] === 'string' && data[key].length > 100;
        const FormComponent = isTextArea ? Textarea : Input;

        return (
          <FormField
            key={fieldPath}
            control={form.control}
            name={fieldPath}
            render={({ field }) => (
              <FormItem className={isTextArea && isGrid ? 'md:col-span-2' : ''}>
                <FormLabel>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</FormLabel>
                <FormControl>
                  <FormComponent {...field} />
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
  const { templates, addTemplate } = useTemplates();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    // We don't use a resolver here because the schema is dynamic
    defaultValues: {
      templateId: templates.length > 0 ? templates[0].id : '',
      data: extractedData,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'data.comparableSales',
  });
  
  // Get the top-level keys from the data to create tabs (excluding comparables)
  const tabKeys = Object.keys(extractedData).filter(key => key !== 'comparableSales' && typeof extractedData[key] === 'object' && !Array.isArray(extractedData[key]));
  const defaultTab = tabKeys.length > 0 ? tabKeys[0] : 'comparables';
  

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUri = e.target?.result as string;
          const newTemplate: Template = {
            id: `template-${Date.now()}`,
            name: file.name,
            dataUri: dataUri,
            file: file,
          };
          addTemplate(newTemplate);
          form.setValue('templateId', newTemplate.id); // Select the new template
          toast({ title: 'Template Uploaded', description: `"${file.name}" has been added and selected.` });
        };
        reader.onerror = (err) => {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not read the file.' });
        }
        reader.readAsDataURL(file);
      } else {
        toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload a .docx file.' });
      }
    }
     if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };


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

    } catch (error: any) {
        console.error('Error generating report:', error);
        toast({
            variant: 'destructive',
            title: 'Uh oh! Something went wrong.',
            description: `There was a problem generating your report. ${error.message}`,
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
                  <div className="flex items-center justify-between">
                    <FormLabel>Select Report Template</FormLabel>
                    <div>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".docx" className="hidden" />
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Template
                        </Button>
                    </div>
                  </div>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
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
            
            <Tabs defaultValue={defaultTab}>
               <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
                 {tabKeys.map(key => (
                    <TabsTrigger key={key} value={key}>
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </TabsTrigger>
                 ))}
                 {extractedData.comparableSales && <TabsTrigger value="comparableSales">Comparables</TabsTrigger>}
              </TabsList>
              
               {tabKeys.map(key => (
                  <TabsContent key={key} value={key} className="space-y-4 pt-4">
                    {renderFormSection(form, `data.${key}`, form.getValues(`data.${key}`))}
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
                        </Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ compAddress: '', compSaleDate: '', compSalePrice: '', compLandArea: '', compFloorArea: '' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Comparable Sale
                    </Button>
                    </div>
                </TabsContent>
              )}

                {/* Render other top-level string fields */}
                {Object.keys(extractedData).filter(key => typeof extractedData[key] === 'string').map(key => (
                    <FormField
                        key={key}
                        control={form.control}
                        name={`data.${key}`}
                        render={({ field }) => (
                        <FormItem className="pt-4">
                            <FormLabel>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</FormLabel>
                            <FormControl>
                            <Textarea {...field} rows={4} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                ))}

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
