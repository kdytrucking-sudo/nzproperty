'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Download, ExternalLink } from 'lucide-react';

type Step3ResultProps = {
  onStartOver: () => void;
};

export function Step3Result({ onStartOver }: Step3ResultProps) {
  const handleDownload = () => {
    // In a real application, this would trigger a download of the .docx file
    alert('Downloading report as .docx file...');
  };

  const handleOpenInGoogleDocs = () => {
    // In a real application, this would open the Google Doc in a new tab
    alert('Opening report in Google Docs...');
    window.open('https://docs.google.com', '_blank');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto bg-green-100 rounded-full p-3 w-fit">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <CardTitle className="mt-4 text-2xl">Report Generated Successfully!</CardTitle>
        <CardDescription>
          Your professional property valuation report has been created.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        <div className="flex w-full space-x-4">
          <Button className="flex-1" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download as Word
          </Button>
          <Button variant="secondary" className="flex-1" onClick={handleOpenInGoogleDocs}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open in Google Docs
          </Button>
        </div>
        <Button variant="link" onClick={onStartOver}>
          Generate another report
        </Button>
      </CardContent>
    </Card>
  );
}
