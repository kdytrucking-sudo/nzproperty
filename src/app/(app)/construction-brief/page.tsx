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

const formSchema = z.object({
    generalConstruction: z.array(z.string()),
    interior: z.array(z.string()),
    finalBrief: z.string(),
});

type ConstructionBriefForm = z.infer<typeof formSchema>;

export default function ConstructionBriefPage() {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);
    
    const form = useForm<ConstructionBriefForm>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            generalConstruction: [],
            interior: [],
            finalBrief: '',
        },
    });
    
    React.useEffect(() => {
        async function loadBrief() {
            setIsLoading(true);
            try {
                const data = await getConstructionBrief();
                form.setValue('finalBrief', data.brief);
            } catch (error: any) {
                // It's okay if the file doesn't exist, it will be created on save.
                if (!error.message.includes('ENOENT')) {
                    toast({ variant: 'destructive', title: 'Failed to load existing brief', description: error.message });
                }
            } finally {
                setIsLoading(false);
            }
        }
        loadBrief();
    }, [form, toast]);


    const generateBrief = () => {
        const { generalConstruction, interior } = form.getValues();

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
        form.setValue('finalBrief', fullBrief);
    };
    
    const onSave = async (values: ConstructionBriefForm) => {
        setIsSaving(true);
        try {
            await saveConstructionBrief({ brief: values.finalBrief });
            toast({ title: 'Success', description: 'Construction brief saved successfully.' });
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
                        Manage Construction Brief
                    </h1>
                    <p className="text-muted-foreground">
                        Select elements to build the construction brief, then generate and edit the final text.
                    </p>
                </header>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>General Construction Elements</CardTitle>
                            <CardDescription>Select the elements for the first sentence.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <FormField
                                control={form.control}
                                name="generalConstruction"
                                render={() => (
                                    <div className="grid grid-cols-2 gap-4">
                                        {generalConstructionOptions.map((item) => (
                                            <FormField
                                                key={item.id}
                                                control={form.control}
                                                name="generalConstruction"
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

                    <Card>
                        <CardHeader>
                            <CardTitle>Interior Elements</CardTitle>
                            <CardDescription>Select the elements for the second sentence.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <FormField
                                control={form.control}
                                name="interior"
                                render={() => (
                                    <div className="grid grid-cols-2 gap-4">
                                        {interiorOptions.map((item) => (
                                            <FormField
                                                key={item.id}
                                                control={form.control}
                                                name="interior"
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
                        <Controller
                            name="finalBrief"
                            control={form.control}
                            render={({ field }) => (
                                <Textarea {...field} rows={8} className="font-mono"/>
                            )}
                        />
                    </CardContent>
                </Card>

                 <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Construction Brief
                    </Button>
                </div>
            </form>
        </Form>
    );
}
