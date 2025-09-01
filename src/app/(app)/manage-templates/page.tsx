'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, Loader2, FilePlus2, Trash2 } from 'lucide-react';
import * as React from 'react';
import { useTemplates, type Template } from '@/hooks/use-templates';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"


export default function ManageTemplatesPage() {
  const { toast } = useToast();
  const { templates, addTemplate, removeTemplate } = useTemplates();
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        setIsUploading(true);
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
          toast({ title: 'Template Uploaded', description: `"${file.name}" has been added.` });
          setIsUploading(false);
        };
        reader.onerror = (err) => {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not read the file.' });
            setIsUploading(false);
        }
        reader.readAsDataURL(file);
      } else {
        toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload a .docx file.' });
      }
    }
     // Reset file input to allow uploading the same file again
     if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">
          Manage Templates
        </h1>
        <p className="text-muted-foreground">
          Upload and manage your .docx report templates. Placeholders like `{{'{'}}{{'{'}}address{'}'}}{'}'}` will be replaced with data.
        </p>
      </header>

      <main>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Your Templates</CardTitle>
                <CardDescription>
                These templates will be available when generating a new report.
                </CardDescription>
            </div>
            <div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".docx" className="hidden" />
                <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}
                    Upload .docx Template
                </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                        No templates uploaded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
