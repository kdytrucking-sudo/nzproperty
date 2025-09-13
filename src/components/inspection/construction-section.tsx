
'use client';

import * as React from 'react';
import { FormField, FormItem, FormControl, FormLabel } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const generalConstructionOptions = [
    { id: 'concrete slab foundation', label: 'concrete slab foundation' }, { id: 'pile foundation', label: 'pile foundation' }, { id: 'concrete ring wall', label: 'concrete ring wall' }, { id: 'concrete flooring', label: 'concrete flooring' }, { id: 'timber flooring', label: 'timber flooring' }, { id: 'brick cladding', label: 'brick cladding' }, { id: 'timber weatherboard cladding', label: 'timber weatherboard cladding' }, { id: 'vertical timber cladding', label: 'vertical timber cladding' }, { id: 'horizontal timber cladding', label: 'horizontal timber cladding' }, { id: 'plaster cladding', label: 'plaster cladding' }, { id: 'concrete cladding', label: 'concrete cladding' }, { id: 'fibre cement sheet cladding', label: 'fibre cement sheet cladding' }, { id: 'tile cladding', label: 'tile cladding' }, { id: 'steel cladding', label: 'steel cladding' }, { id: 'concrete block cladding', label: 'concrete block cladding' }, { id: 'aluminium joinery', label: 'aluminium joinery' }, { id: 'double glazed aluminium joinery', label: 'double glazed aluminium joinery' }, { id: 'timber joinery', label: 'timber joinery' }, { id: 'metal roof', label: 'metal roof' }, { id: 'tile roof', label: 'tile roof' }, { id: 'longrun steel roof', label: 'longrun steel roof' }, { id: 'concrete tile roof', label: 'concrete tile roof' }, { id: 'metal tile roof', label: 'metal tile roof' },
];

const interiorOptions = [
    { id: 'plasterboard', label: 'plasterboard' }, { id: 'soft board', label: 'soft board' }, { id: 'hard board', label: 'hard board' }, { id: 'tile ceiling', label: 'tile ceiling' }, { id: 'plaster ceiling', label: 'plaster ceiling' },
];

type SectionProps = {
  control: any;
  setValue: any;
  getValues: any;
}

export default function ConstructionSection({ control, setValue, getValues }: SectionProps) {
  const generateBrief = () => {
    const { generalConstruction, interior } = getValues('constructionBrief');
    let firstSentence = 'General construction elements comprise what appears to be ';
    if (generalConstruction.length > 0) {
      firstSentence += generalConstruction.length === 1 ? generalConstruction[0] + '.' : `${generalConstruction.slice(0, -1).join(', ')} and ${generalConstruction[generalConstruction.length - 1]}.`;
    }
    let secondSentence = 'The interior appears to be mostly timber framed with ';
    if (interior.length > 0) {
      secondSentence += interior.length === 1 ? interior[0] : `${interior.slice(0, -1).join(', ')} and ${interior[interior.length - 1]}`;
    }
    secondSentence += ' or of similar linings.';
    setValue('constructionBrief.finalBrief', `${firstSentence}\n${secondSentence}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-base">General Construction</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <FormField
            control={control}
            name="constructionBrief.generalConstruction"
            render={() => (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-1">
                {generalConstructionOptions.map((item) => (
                  <FormField
                    key={item.id}
                    control={control}
                    name="constructionBrief.generalConstruction"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(item.id)}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              return checked ? field.onChange([...current, item.id]) : field.onChange(current.filter((v) => v !== item.id));
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal text-sm">{item.label}</FormLabel>
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
        <CardHeader className="p-3">
          <CardTitle className="text-base">Interior</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <FormField
            control={control}
            name="constructionBrief.interior"
            render={() => (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-1">
                {interiorOptions.map((item) => (
                  <FormField
                    key={item.id}
                    control={control}
                    name="constructionBrief.interior"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(item.id)}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              return checked ? field.onChange([...current, item.id]) : field.onChange(current.filter((v) => v !== item.id));
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal text-sm">{item.label}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            )}
          />
        </CardContent>
      </Card>
      
      <Button type="button" onClick={generateBrief} className="w-full">Generate Construction Brief</Button>
      <FormField
        control={control}
        name="constructionBrief.finalBrief"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Generated Brief</FormLabel>
            <FormControl><Textarea {...field} rows={6} className="text-sm"/></FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
