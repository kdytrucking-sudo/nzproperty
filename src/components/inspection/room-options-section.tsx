'use client';

import * as React from 'react';
import { useFieldArray } from 'react-hook-form';
import { PlusCircle, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, FormItem, FormControl, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { roomOptionsConfig, roomTypes } from '@/lib/room-options-config';

type SectionProps = {
  control: any;
  setValue: any;
  getValues: any;
  watch: any;
};

export default function RoomOptionsSection({ control, setValue, watch }: SectionProps) {
  const { toast } = useToast();
  const [selectedRoomType, setSelectedRoomType] = React.useState<string>(roomTypes[0]);

  const { fields, prepend, remove } = useFieldArray({
    control,
    name: 'roomOptions',
  });
  
  const watchedFields = watch('roomOptions');

  const handleAddRoom = () => {
    if (fields.length >= 20) {
      toast({
        variant: 'destructive',
        title: 'Room Limit Reached',
        description: 'You can add a maximum of 20 rooms.',
      });
      return;
    }
    prepend({
      id: crypto.randomUUID(),
      roomType: selectedRoomType,
      roomName: selectedRoomType,
      selectedOptions: [],
      roomOptionText: '',
    });
  };

  const handleCheckboxChange = (checked: boolean, option: string, fieldIndex: number) => {
    const currentSelections = watchedFields[fieldIndex].selectedOptions || [];
    const newSelections = checked
      ? [...currentSelections, option]
      : currentSelections.filter((sel: string) => sel !== option);

    setValue(`roomOptions.${fieldIndex}.selectedOptions`, newSelections, { shouldDirty: true });
    setValue(`roomOptions.${fieldIndex}.roomOptionText`, newSelections.join(', '), { shouldDirty: true });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Room</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a room type..." />
              </SelectTrigger>
              <SelectContent>
                {roomTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={handleAddRoom} size="icon">
              <PlusCircle className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {fields.map((field, index) => {
          const roomOptions = roomOptionsConfig[field.roomType as keyof typeof roomOptionsConfig] || [];
          const selectedOptions = watchedFields?.[index]?.selectedOptions || [];

          return (
            <Card key={field.id}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">Room {fields.length - index}</CardTitle>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={control}
                  name={`roomOptions.${index}.roomName`}
                  render={({ field: formField }) => (
                    <FormItem>
                      <FormLabel>Room Name</FormLabel>
                      <FormControl><Input {...formField} /></FormControl>
                    </FormItem>
                  )}
                />
                
                <div className="space-y-2">
                  <FormLabel>Features</FormLabel>
                  <div className="space-y-2 rounded-md border p-4 max-h-60 overflow-y-auto">
                    {roomOptions.map((option) => (
                        <FormItem key={option} className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                                <Checkbox
                                    checked={selectedOptions.includes(option)}
                                    onCheckedChange={(checked) => handleCheckboxChange(!!checked, option, index)}
                                />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">{option}</FormLabel>
                        </FormItem>
                    ))}
                  </div>
                </div>

                <FormField
                  control={control}
                  name={`roomOptions.${index}.roomOptionText`}
                  render={({ field: formField }) => (
                    <FormItem>
                      <FormLabel>Generated Text</FormLabel>
                      <FormControl><Input {...formField} /></FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
