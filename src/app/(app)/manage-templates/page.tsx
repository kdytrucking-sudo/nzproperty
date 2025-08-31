'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, Loader2 } from 'lucide-react';
import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';
import mammoth from 'mammoth';

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });


type Template = {
  id: string;
  name: string;
  content: string; // Content will be HTML string
};

// Mock data - in a real app, this would come from a database
const initialTemplates: Template[] = [
  { id: 'standard-v1', name: 'Standard Valuation Report v1', content: '<h1>Standard Valuation Report</h1><p>This is the content for the standard valuation report. Version 1.</p>' },
  { id: 'commercial-v1', name: 'Commercial Property Report', content: '<h1>Commercial Property Report</h1><p>This is the template for commercial properties.</p>' },
];

export default function ManageTemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState<Template[]>(initialTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(null);
  const [editorContent, setEditorContent] = React.useState('');
  const [newTemplateName, setNewTemplateName] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (selectedTemplateId) {
      const selected = templates.find(t => t.id === selectedTemplateId);
      setEditorContent(selected?.content || '');
    } else {
      setEditorContent('');
    }
  }, [selectedTemplateId, templates]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };
  
  const handleSave = () => {
    if (!newTemplateName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Template name cannot be empty.' });
      return;
    }

    setIsSaving(true);
    // Simulate saving
    setTimeout(() => {
      const newTemplate: Template = {
        id: `template-${Date.now()}`,
        name: newTemplateName,
        content: editorContent,
      };
      setTemplates(prev => [...prev, newTemplate]);
      setSelectedTemplateId(newTemplate.id);
      toast({ title: 'Template Saved', description: `"${newTemplate.name}" has been saved.` });
      setIsSaving(false);
      setNewTemplateName('');
      setIsSaveDialogOpen(false);
    }, 1000);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          try {
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setEditorContent(result.value);
            setSelectedTemplateId(null);
            toast({ title: 'Word Document Loaded', description: 'Content has been loaded into the editor.' });
          } catch (error) {
            console.error('Error converting .docx to HTML', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not parse the Word document.' });
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload a .docx file.' });
      }
    }
     // Reset file input to allow uploading the same file again
     if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    // Simulate exporting to Google Doc
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast({
      title: 'Export Complete',
      description: 'The template has been exported to Google Docs.',
    });
    // In a real app, this would open the Google Doc link.
    window.open('https://docs.google.com', '_blank');
    setIsExporting(false);
  };


  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">
          Manage Templates
        </h1>
        <p className="text-muted-foreground">
          Create, edit, and manage your report templates with rich text formatting.
        </p>
      </header>

      <main>
        <Card>
          <CardHeader>
            <CardTitle>Template Editor</CardTitle>
            <CardDescription>
              Select a template to edit, or upload a new Word document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Select Template</label>
                    <Select onValueChange={handleTemplateSelect} value={selectedTemplateId || ''}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a template..." />
                        </SelectTrigger>
                        <SelectContent>
                            {templates.map(template => (
                            <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-end gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".docx" className="hidden" />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Word (.docx)
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="template-editor" className="text-sm font-medium">Template Content</label>
                <div className="bg-background">
                  <ReactQuill
                      id="template-editor"
                      theme="snow"
                      value={editorContent}
                      onChange={setEditorContent}
                      placeholder="Template content will appear here. Start typing, select a template, or upload a file."
                      className="min-h-[400px]"
                  />
                </div>
            </div>
            
            <div className="flex justify-between">
                <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>Save Changes</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Save New Template</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <label htmlFor="template-name" className="text-sm font-medium">Template Name</label>
                            <Input 
                                id="template-name"
                                value={newTemplateName}
                                onChange={(e) => setNewTemplateName(e.target.value)}
                                placeholder="e.g., My Custom Report"
                            />
                        </div>
                        <Button onClick={handleSave} disabled={isSaving}>
                             {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Template
                        </Button>
                    </DialogContent>
                </Dialog>

                <Button onClick={handleExport} disabled={isExporting || !editorContent}>
                    {isExporting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exporting...
                    </>
                    ) : (
                    <>
                        <Download className="mr-2 h-4 w-4" />
                        Export to Google Doc
                    </>
                    )}
                </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
