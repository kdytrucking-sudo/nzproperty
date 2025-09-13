
// This is a new file for the mobile inspection page.
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Mic, Save, Camera, Construction, Home, BookText, Package } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'next/navigation';

import { getDraft } from '@/ai/flows/get-draft';
import { saveDraft } from '@/ai/flows/save-draft';
import { useToast } from '@/hooks/use-toast';
import type { Draft } from '@/lib/drafts-schema';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


// Dynamically import sections to keep initial load small
const ConstructionSection = React.lazy(() => import('@/components/inspection/construction-section'));
const ChattelsSection = React.lazy(() => import('@/components/inspection/chattels-section'));
const RoomOptionsSection = React.lazy(() => import('@/components/inspection/room-options-section'));
const PhotoUploadSection = React.lazy(() => import('@/components/inspection/photo-upload-section'));


const formSchema = z.any(); // Using a flexible schema as in Step2Review

export default function InspectionPage() {
  const params = useParams();
  const { toast } = useToast();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedImagePlaceholder, setSelectedImagePlaceholder] = React.useState<string>('');


  const form = useForm({
    resolver: zodResolver(formSchema),
  });

  const propertyDescriptionSpeech = useSpeechRecognition({
    onResult: (transcript) => form.setValue('data.General Info.Property Description', form.getValues('data.General Info.Property Description') + transcript),
  });
  const locationDescriptionSpeech = useSpeechRecognition({
    onResult: (transcript) => form.setValue('data.General Info.Location Description', form.getValues('data.General Info.Location Description') + transcript),
  });


  React.useEffect(() => {
    const draftId = params.draftId as string;
    async function loadDraft() {
      if (!draftId) return;

      setIsLoading(true);
      try {
        const draftData = await getDraft({ draftId });
        if (!draftData) {
          throw new Error('Draft not found. It might have been deleted.');
        }
        setDraft(draftData);
        form.reset(draftData.formData);
      } catch (error: any) {
        console.error('Failed to load draft:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to load inspection data',
          description: error.message,
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadDraft();
  }, [params.draftId, form, toast]);

  const handleSaveDraft = async () => {
    setIsSaving(true);
    const formData = form.getValues();
    try {
      await saveDraft({ formData });
      toast({
        title: 'Draft Saved',
        description: 'Your inspection data has been saved successfully.',
      });
    } catch (error: any) {
      console.error('Failed to save draft:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'An unknown error occurred while saving the draft.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl py-8 space-y-6">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  
  if (!draft) {
      return (
          <div className="container mx-auto max-w-2xl py-8">
              <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>Could not load the inspection draft. Please go back and try again.</AlertDescription>
              </Alert>
          </div>
      )
  }

  return (
    <div className="container mx-auto max-w-3xl py-8 pb-24">
      <header className="mb-8">
        <h1 className="font-headline text-2xl font-bold text-foreground">
          Field Inspection
        </h1>
        <p className="text-muted-foreground break-words">
          {draft.propertyAddress}
        </p>
      </header>

      <main>
        <Form {...form}>
            <Accordion type="single" collapsible defaultValue='item-1' className="w-full space-y-4">
              
              <AccordionItem value="item-1" className="border-b-0">
                <Card>
                  <CardHeader className="p-4">
                     <AccordionTrigger className="p-0 hover:no-underline">
                      <div className="flex items-center gap-3">
                          <BookText className="h-5 w-5 text-primary"/>
                          <CardTitle className="text-lg">Descriptions</CardTitle>
                      </div>
                    </AccordionTrigger>
                  </CardHeader>
                  <AccordionContent>
                    <CardContent className="p-4 pt-0 space-y-4">
                       <FormField
                          control={form.control}
                          name="data.General Info.Property Description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Property Description</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Textarea {...field} rows={6} />
                                  <Button 
                                    type="button" 
                                    size="icon"
                                    variant={propertyDescriptionSpeech.isListening ? 'destructive' : 'outline'}
                                    onClick={propertyDescriptionSpeech.toggleListening}
                                    className="absolute bottom-2 right-2"
                                  >
                                    <Mic className="h-4 w-4" />
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={form.control}
                          name="data.General Info.Location Description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location Description</FormLabel>
                              <FormControl>
                                 <div className="relative">
                                  <Textarea {...field} rows={6} />
                                   <Button 
                                    type="button" 
                                    size="icon"
                                    variant={locationDescriptionSpeech.isListening ? 'destructive' : 'outline'}
                                    onClick={locationDescriptionSpeech.toggleListening}
                                    className="absolute bottom-2 right-2"
                                  >
                                    <Mic className="h-4 w-4" />
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
              
              <AccordionItem value="item-2" className="border-b-0">
                <Card>
                  <CardHeader className="p-4">
                    <AccordionTrigger className="p-0 hover:no-underline">
                      <div className="flex items-center gap-3">
                          <Construction className="h-5 w-5 text-primary"/>
                          <CardTitle className="text-lg">Construction</CardTitle>
                      </div>
                    </AccordionTrigger>
                  </CardHeader>
                  <AccordionContent>
                      <CardContent className="p-4 pt-0">
                        <React.Suspense fallback={<Skeleton className="h-64 w-full" />}>
                            <ConstructionSection control={form.control} setValue={form.setValue} getValues={form.getValues} />
                        </React.Suspense>
                      </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
              
              <AccordionItem value="item-3" className="border-b-0">
                <Card>
                  <CardHeader className="p-4">
                     <AccordionTrigger className="p-0 hover:no-underline">
                      <div className="flex items-center gap-3">
                          <Home className="h-5 w-5 text-primary"/>
                          <CardTitle className="text-lg">Room Options</CardTitle>
                      </div>
                    </AccordionTrigger>
                  </CardHeader>
                  <AccordionContent>
                    <CardContent className="p-4 pt-0">
                       <React.Suspense fallback={<Skeleton className="h-64 w-full" />}>
                            <RoomOptionsSection control={form.control} setValue={form.setValue} getValues={form.getValues} watch={form.watch} />
                        </React.Suspense>
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-b-0">
                <Card>
                  <CardHeader className="p-4">
                    <AccordionTrigger className="p-0 hover:no-underline">
                      <div className="flex items-center gap-3">
                          <Package className="h-5 w-5 text-primary"/>
                          <CardTitle className="text-lg">Chattels</CardTitle>
                      </div>
                    </AccordionTrigger>
                  </CardHeader>
                  <AccordionContent>
                      <CardContent className="p-4 pt-0">
                        <React.Suspense fallback={<Skeleton className="h-48 w-full" />}>
                            <ChattelsSection control={form.control} setValue={form.setValue} getValues={form.getValues} />
                        </React.Suspense>
                      </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
              
              <AccordionItem value="item-5" className="border-b-0">
                <Card>
                  <CardHeader className="p-4">
                    <AccordionTrigger className="p-0 hover:no-underline">
                      <div className="flex items-center gap-3">
                          <Camera className="h-5 w-5 text-primary"/>
                          <CardTitle className="text-lg">Photos</CardTitle>
                      </div>
                    </AccordionTrigger>
                  </CardHeader>
                  <AccordionContent>
                      <CardContent className="p-4 pt-0">
                         <React.Suspense fallback={<Skeleton className="h-48 w-full" />}>
                            <PhotoUploadSection control={form.control} selectedPlaceholder={selectedImagePlaceholder} setSelectedPlaceholder={setSelectedImagePlaceholder}/>
                        </React.Suspense>
                      </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>

            </Accordion>
        </Form>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background/80 p-4 border-t backdrop-blur-sm">
        <Button onClick={handleSaveDraft} disabled={isSaving} className="w-full h-12 text-lg">
          {isSaving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</> : <><Save className="mr-2 h-5 w-5" /> Save Inspection Data</>}
        </Button>
      </div>
    </div>
  );
}
