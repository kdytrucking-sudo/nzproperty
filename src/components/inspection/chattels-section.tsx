
'use client';

import * as React from 'react';
import { FormField, FormItem, FormControl, FormLabel } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const chattelsOptions = [
    { id: 'carpets', label: 'carpets' }, { id: 'lightings', label: 'lightings' }, { id: 'blinds', label: 'blinds' }, { id: 'curtains', label: 'curtains' },
];

type SectionProps = {
  control: any;
  setValue: any;
  getValues: any;
}

export default function ChattelsSection({ control, setValue, getValues }: SectionProps) {
  
  const generateChattelsBrief = () => {
    const { selected } = getValues('chattels');
    if (selected.length === 0) {
      setValue('chattels.finalBrief', '');
      return;
    }
    const list = selected.length === 1 ? selected[0] : `${selected.slice(0, -1).join(', ')} and ${selected[selected.length - 1]}`;
    setValue('chattels.finalBrief', `We have included in our valuation an allowance for chattels including ${list}.`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chattels</CardTitle>
        </CardHeader>
        <CardContent>
          <FormField
            control={control}
            name="chattels.selected"
            render={() => (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {chattelsOptions.map((item) => (
                  <FormField
                    key={item.id}
                    control={control}
                    name="chattels.selected"
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
      <Button type="button" onClick={generateChattelsBrief} className="w-full">Generate Chattels Brief</Button>
      <FormField
        control={control}
        name="chattels.finalBrief"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Generated Chattels Brief</FormLabel>
            <FormControl><Textarea {...field} rows={3} className="text-sm"/></FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
