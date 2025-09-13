'use client';

import * as React from 'react';
import { useFieldArray } from 'react-hook-form';
import { PlusCircle, Trash2, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FormField, FormItem, FormControl, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { roomOptionsConfig, roomTypes } from '@/lib/room-options-config';
import { cn } from '@/lib/utils';

type SectionProps = {
  control: any;
  setValue: any;
  getValues: any;
  watch: any;
};

export default function RoomOptionsSection({ control, setValue, watch }: SectionProps) {
  const { toast } = useToast();
  const [selectedRoomType, setSelectedRoomType] = React.useState<string>(roomTypes[0]);
  const [expandedRoomId, setExpandedRoomId] = React.useState<string | null>(null);

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
    const newRoomId = crypto.randomUUID();
    prepend({
      id: newRoomId,
      roomType: selectedRoomType,
      roomName: selectedRoomType,
      selectedOptions: [],
      roomOptionText: '',
    });
    setExpandedRoomId(newRoomId);
  };

  const handleCheckboxChange = (checked: boolean, option: string, fieldIndex: number) => {
    const currentSelections = watchedFields[fieldIndex].selectedOptions || [];
    const newSelections = checked
      ? [...currentSelections, option]
      : currentSelections.filter((sel: string) => sel !== option);

    setValue(`roomOptions.${fieldIndex}.selectedOptions`, newSelections, { shouldDirty: true });
    setValue(`roomOptions.${fieldIndex}.roomOptionText`, newSelections.join(', '), { shouldDirty: true });
  };
  
  const toggleExpand = (roomId: string) => {
    setExpandedRoomId(prevId => (prevId === roomId ? null : roomId));
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
          const isOpen = expandedRoomId === field.id;

          return (
             <Collapsible key={field.id} open={isOpen} onOpenChange={() => toggleExpand(field.id)} asChild>
                <Card>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 cursor-pointer">
                        <div className="flex-1 min-w-0">
                           <div className={cn("grid grid-cols-2 gap-x-2 items-center", isOpen && "hidden")}>
                                <FormField
                                  control={control}
                                  name={`roomOptions.${index}.roomName`}
                                  render={({ field: formField }) => (
                                      <Input {...formField} className="text-sm h-9" readOnly placeholder="Room Name"/>
                                  )}
                                />
                                <FormField
                                  control={control}
                                  name={`roomOptions.${index}.roomOptionText`}
                                  render={({ field: formField }) => (
                                      <Input {...formField} className="text-sm h-9" readOnly placeholder="Features"/>
                                  )}
                                />
                           </div>
                           <div className={cn("font-semibold", !isOpen && "hidden")}>
                                Room {fields.length - index}
                           </div>
                        </div>
                        <div className="flex items-center gap-0">
                            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove(index); }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <div className="p-2">
                               <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                            </div>
                        </div>
                      </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent asChild>
                    <CardContent className="space-y-4 pt-0">
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
                            name={`roomOptions.${index}.roomName`}
                            render={({ field: formField }) => (
                                <FormItem>
                                <FormLabel>Room Name</FormLabel>
                                <FormControl><Input {...formField} /></FormControl>
                                </FormItem>
                            )}
                        />
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
                  </CollapsibleContent>
                </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
