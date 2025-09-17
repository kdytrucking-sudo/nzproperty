'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FilePlus2, Trash2, Download } from 'lucide-react';
import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from '@/components/ui/skeleton';
import { listTemplates, type TemplateFile } from '@/ai/flows/list-templates';
import { uploadTemplate } from '@/ai/flows/upload-template';
import { deleteTemplate } from '@/ai/flows/delete-template';

const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
};

export default function ManageTemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState<TemplateFile[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchTemplates = React.useCallback(async () => {
    try {
      const templateList = await listTemplates();
      setTemplates(templateList);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error fetching templates', description: error.message });
    } finally {
      setIsLoaded(true);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && file.name.endsWith('.docx')) {
        setIsUploading(true);
        try {
          const dataUri = await fileToDataUri(file);
          await uploadTemplate({ fileName: file.name, dataUri });
          toast({ title: 'Template Uploaded', description: `"${file.name}" has been saved.` });
          await fetchTemplates(); // Refresh the list
        } catch (error: any) {
          toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        } finally {
          setIsUploading(false);
        }
      } else {
        toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload a valid .docx file.' });
      }
    }
     // Reset file input to allow uploading the same file again
     if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleDeleteTemplate = async (fileName: string) => {
    setDeletingId(fileName);
    try {
        await deleteTemplate({ fileName });
        toast({ title: 'Template Deleted', description: `"${fileName}" has been removed.` });
        setTemplates(prev => prev.filter(t => t.name !== fileName));
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
    } finally {
        setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">
          Manage Templates
        </h1>
        <p className="text-muted-foreground">
          Upload and manage your .docx report templates. These are saved on the server for global use.
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
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!isLoaded ? (
                     <TableRow>
                        <TableCell colSpan={2}>
                           <div className="flex items-center space-x-2">
                             <Skeleton className="h-6 w-6 rounded-full" />
                             <Skeleton className="h-6 w-1/2" />
                           </div>
                        </TableCell>
                    </TableRow>
                  ) : templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                        No templates uploaded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((template) => (
                      <TableRow key={template.name}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="icon">
                             <a href={template.downloadUrl} download={template.name} target="_blank">
                               <Download className="h-4 w-4" />
                             </a>
                           </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteTemplate(template.name)}
                            disabled={deletingId === template.name}
                          >
                            {deletingId === template.name ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive" />}
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
