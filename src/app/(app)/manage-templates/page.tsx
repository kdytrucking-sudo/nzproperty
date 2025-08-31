'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Loader2 } from 'lucide-react';
import * as React from 'react';

export default function ManageTemplatesPage() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = React.useState(false);

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
          Edit and export your report templates.
        </p>
      </header>

      <main>
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Standard Valuation Report</CardTitle>
            <CardDescription>
              This is the main template used for generating property valuation reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end">
               <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileUp className="mr-2 h-4 w-4" />
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
