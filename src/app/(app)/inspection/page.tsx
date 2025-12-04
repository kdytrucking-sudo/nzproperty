
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookDown, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { listDrafts } from '@/ai/flows/list-drafts';
import { saveDraft } from '@/ai/flows/save-draft';
import type { DraftSummary } from '@/lib/drafts-schema';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  address: z.string().min(1, 'Property address is required to start a new inspection.'),
});

export default function InspectionLandingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isCreating, setIsCreating] = React.useState(false);
  const [drafts, setDrafts] = React.useState<DraftSummary[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = React.useState(true);
  const [selectedDraftId, setSelectedDraftId] = React.useState<string>('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      address: '',
    },
  });

  React.useEffect(() => {
    async function loadDrafts() {
      setIsLoadingDrafts(true);
      try {
        const draftList = await listDrafts();
        setDrafts(draftList);
      } catch (error) {
        console.error('Failed to load drafts:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to load drafts',
          description: 'Could not retrieve the list of saved drafts.',
        });
      } finally {
        setIsLoadingDrafts(false);
      }
    }
    loadDrafts();
  }, [toast]);

  const handleDraftSelection = (draftId: string) => {
    setSelectedDraftId(draftId);
  };

  const handleLoadDraft = () => {
    if (!selectedDraftId) {
      toast({ variant: 'destructive', title: 'No Draft Selected', description: 'Please choose a draft from the list.' });
      return;
    }
    router.push(`/inspection/${selectedDraftId}`);
  };

  async function onCreateNew(values: z.infer<typeof formSchema>) {
    setIsCreating(true);
    try {
      const { draftId } = await saveDraft({ 
          formData: { 
            data: { Info: { 'Property Address': values.address } } 
          } 
      });
      if (!draftId) throw new Error('Failed to get a draft ID from the server.');

      toast({
        title: 'New Inspection Started',
        description: `Created a new draft for ${values.address}.`,
      });
      router.push(`/inspection/${draftId}`);
    } catch (error: any) {
      console.error('Failed to create new draft:', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: error.message || 'There was a problem creating a new inspection draft.',
      });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="px-2 py-8">
      <header className="text-center mb-8">
        <h1 className="font-headline text-3xl font-bold text-foreground">
          Field Inspection
        </h1>
        <p className="text-muted-foreground">
          Load an existing draft or start a new inspection on-site.
        </p>
      </header>

      <main className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Load Existing Inspection</CardTitle>
            <CardDescription>Select a previously saved draft to continue your work.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              {isLoadingDrafts ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select onValueChange={handleDraftSelection} value={selectedDraftId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a draft..." />
                  </SelectTrigger>
                  <SelectContent>
                    {drafts.length > 0 ? drafts.map(d => (
                      <SelectItem key={d.draftId} value={d.draftId}>
                        {d.propertyAddress}
                      </SelectItem>
                    )) : <SelectItem value="none" disabled>No drafts found</SelectItem>}
                  </SelectContent>
                </Select>
              )}
              <Button type="button" onClick={handleLoadDraft} disabled={!selectedDraftId} className="w-full sm:w-auto">
                <BookDown className="mr-2 h-4 w-4" />
                Load
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          <Separator />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-background px-2 text-xs uppercase text-muted-foreground">Or</span>
          </div>
        </div>
        
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateNew)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Start a New Inspection</CardTitle>
                        <CardDescription>Enter the property address to create a new inspection draft.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="sr-only">Property Address</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., 123 Queen Street, Auckland" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <div className="flex justify-end">
                            <Button type="submit" disabled={isCreating}>
                                {isCreating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Starting...
                                </>
                                ) : (
                                'Start New Inspection'
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </Form>

      </main>
    </div>
  );
}
