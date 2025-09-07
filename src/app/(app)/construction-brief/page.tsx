'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { saveConstructionBrief } from '@/ai/flows/save-construction-brief';
import { getConstructionBrief } from '@/ai/flows/get-construction-brief';
import { Skeleton } from '@/components/ui/skeleton';

const constructionAndChattelsOptions = [
    // Construction
    { id: 'concrete slab foundation', label: 'concrete slab foundation', type: 'construction' },
    { id: 'pile foundation', label: 'pile foundation', type: 'construction' },
    { id: 'concrete ring wall', label: 'concrete ring wall', type: 'construction' },
    { id: 'concrete flooring', label: 'concrete flooring', type: 'construction' },
    { id: 'timber flooring', label: 'timber flooring', type: 'construction' },
    { id: 'brick cladding', label: 'brick cladding', type: 'construction' },
    { id: 'timber weatherboard cladding', label: 'timber weatherboard cladding', type: 'construction' },
    { id: 'vertical timber cladding', label: 'vertical timber cladding', type: 'construction' },
    { id: 'horizontal timber cladding', label: 'horizontal timber cladding', type: 'construction' },
    { id: 'plaster cladding', label: 'plaster cladding', type: 'construction' },
    { id: 'concrete cladding', label: 'concrete cladding', type: 'construction' },
    { id: 'fibre cement sheet cladding', label: 'fibre cement sheet cladding', type: 'construction' },
    { id: 'tile cladding', label: 'tile cladding', type: 'construction' },
    { id: 'steel cladding', label: 'steel cladding', type: 'construction' },
    { id: 'concrete block cladding', label: 'concrete block cladding', type: 'construction' },
    { id: 'aluminium joinery', label: 'aluminium joinery', type: 'construction' },
    { id: 'double glazed aluminium joinery', label: 'double glazed aluminium joinery', type: 'construction' },
    { id: 'timber joinery', label: 'timber joinery', type: 'construction' },
    { id: 'metal roof', label: 'metal roof', type: 'construction' },
    { id: 'tile roof', label: 'tile roof', type: 'construction' },
    { id: 'longrun steel roof', label: 'longrun steel roof', type: 'construction' },
    { id: 'concrete tile roof', label: 'concrete tile roof', type: 'construction' },
    { id: 'metal tile roof', label: 'metal tile roof', type: 'construction' },
    { id: 'plasterboard', label: 'plasterboard', type: 'construction' },
    { id: 'soft board', label: 'soft board', type: 'construction' },
    { id: 'hard board', label: 'hard board', type: 'construction' },
    { id: 'tile ceiling', label: 'tile ceiling', type: 'construction' },
    { id: 'plaster ceiling', label: 'plaster ceiling', type: 'construction' },

    // Chattels (can be shared or separate)
    { id: 'blinds', label: 'blinds', type: 'chattel'},
    { id: 'curtains', label: 'curtains', type: 'chattel'},
    { id: 'drapes', label: 'drapes', type: 'chattel'},
    { id: 'fixed floor coverings', label: 'fixed floor coverings', type: 'chattel'},
    { id: 'light fittings', label: 'light fittings', type: 'chattel'},
    { id: 'stove', label: 'stove', type: 'chattel'},
];


const formSchema = z.object({
    selectedOptions: z.array(z.string()),
    finalBrief: z.string(),
    chattelsBrief: z.string(),
});

type ConstructionBriefForm = z.infer<typeof formSchema>;

export default function ConstructionBriefPage() {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);
    
    const form = useForm<ConstructionBriefForm>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            selectedOptions: [],
            finalBrief: '',
            chattelsBrief: '',
        },
    });
    
    React.useEffect(() => {
        async function loadBrief() {
            setIsLoading(true);
            try {
                const data = await getConstructionBrief();
                form.setValue('finalBrief', data.brief || '');
                form.setValue('chattelsBrief', data.chattelsBrief || '');
            } catch (error: any) {
                // It's okay if the file doesn't exist, it will be created on save.
                if (!error.message.includes('ENOENT')) {
                    toast({ variant: 'destructive', title: 'Failed to load existing briefs', description: error.message });
                }
            } finally {
                setIsLoading(false);
            }
        }
        loadBrief();
    }, [form, toast]);


    const generateConstructionBrief = () => {
        const { selectedOptions } = form.getValues();
        const constructionItems = selectedOptions.filter(optId => constructionAndChattelsOptions.find(o => o.id === optId)?.type === 'construction');

        let firstSentence = 'General construction elements comprise what appears to be ';
        if (constructionItems.length > 0) {
            if (constructionItems.length === 1) {
                firstSentence += constructionItems[0] + '.';
            } else {
                const allButLast = constructionItems.slice(0, -1).join(', ');
                const last = constructionItems[constructionItems.length - 1];
                firstSentence += `${allButLast} and ${last}.`;
            }
        } else {
            firstSentence = '';
        }
        
        // This assumes interior is mixed in with general construction now
        let secondSentence = 'The interior appears to be mostly timber framed with plasterboard or of similar linings.';
        
        const fullBrief = `${firstSentence}\n${secondSentence}`.trim();
        form.setValue('finalBrief', fullBrief);
        form.setValue('selectedOptions', []); // Clear selections
    };
    
    const generateChattelsBrief = () => {
        const { selectedOptions } = form.getValues();
        const chattelsItems = selectedOptions.filter(optId => constructionAndChattelsOptions.find(o => o.id === optId)?.type === 'chattel');

        let brief = '';
        if (chattelsItems.length > 0) {
            const list = chattelsItems.join(', ');
            brief = `We have included in our valuation an allowance for chattels including ${list}.`
        }
        form.setValue('chattelsBrief', brief);
        form.setValue('selectedOptions', []); // Clear selections
    }

    const onSave = async (values: ConstructionBriefForm) => {
        setIsSaving(true);
        try {
            await saveConstructionBrief({ 
                brief: values.finalBrief,
                chattelsBrief: values.chattelsBrief
            });
            toast({ title: 'Success', description: 'Construction and Chattels briefs saved successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-8">
                <header>
                    <Skeleton className="h-10 w-1/3" />
                    <Skeleton className="mt-2 h-6 w-2/3" />
                </header>
                <main className="space-y-6">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </main>
            </div>
        )
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-8">
                <header>
                    <h1 className="font-headline text-3xl font-bold text-foreground">
                        Manage Construction & Chattels Brief
                    </h1>
                    <p className="text-muted-foreground">
                        Select elements to build the construction and chattels briefs, then generate and edit the final text.
                    </p>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Construction & Chattels Elements</CardTitle>
                        <CardDescription>Select items to include in the briefs below.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <FormField
                            control={form.control}
                            name="selectedOptions"
                            render={() => (
                                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                                    {constructionAndChattelsOptions.map((item) => (
                                        <FormField
                                            key={item.id}
                                            control={form.control}
                                            name="selectedOptions"
                                            render={({ field }) => {
                                                return (
                                                    <FormItem
                                                        key={item.id}
                                                        className="flex flex-row items-start space-x-3 space-y-0"
                                                    >
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(item.id)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked
                                                                        ? field.onChange([...field.value, item.id])
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
                                                )
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        />
                    </CardContent>
                </Card>
                
                <div className="flex justify-center gap-4">
                    <Button type="button" onClick={generateConstructionBrief}>
                        Generate Construction Brief
                    </Button>
                     <Button type="button" onClick={generateChattelsBrief}>
                        Generate Chattels
                    </Button>
                </div>
                
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Generated Construction Brief</CardTitle>
                            <CardDescription>Review and edit the generated text below. This content will be used for the [Replace_ConstructionBrief] placeholder.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Controller
                                name="finalBrief"
                                control={form.control}
                                render={({ field }) => (
                                    <Textarea {...field} rows={8} className="font-mono"/>
                                )}
                            />
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle>Generated Chattels Brief</CardTitle>
                            <CardDescription>Review and edit the generated text below. This content will be used for the [Replace_Chattels] placeholder.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Controller
                                name="chattelsBrief"
                                control={form.control}
                                render={({ field }) => (
                                    <Textarea {...field} rows={8} className="font-mono"/>
                                )}
                            />
                        </CardContent>
                    </Card>
                </div>


                 <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Briefs
                    </Button>
                </div>
            </form>
        </Form>
    );
}
