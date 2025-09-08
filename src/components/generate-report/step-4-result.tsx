'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Download } from 'lucide-react';
import * as React from 'react';

type Step4ResultProps = {
  reportDataUri: string;
  fileName: string;
  onStartOver: () => void;
  replacementsCount: number;
  debugInstructedBy?: string;
};

export function Step4Result({ reportDataUri, fileName, onStartOver, replacementsCount, debugInstructedBy }: Step4ResultProps) {
  
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = reportDataUri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Automatically trigger download on component mount
  React.useEffect(() => {
    handleDownload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDataUri, fileName]);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto bg-green-100 rounded-full p-3 w-fit">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <CardTitle className="mt-4 text-2xl">Report Generated Successfully!</CardTitle>
        <CardDescription>
            {`Successfully replaced ${replacementsCount} total placeholders. `}
            Your download should start automatically. If it doesn't, use the button below.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        {debugInstructedBy !== undefined && (
          <div className="w-full rounded-md border border-dashed border-yellow-500 bg-yellow-50 p-4">
            <h4 className="font-bold text-yellow-800">Debug Information:</h4>
            <p className="font-mono text-sm text-yellow-900">
              Value of "Instructed By": <span className="font-semibold">{debugInstructedBy || '"" (Empty String)'}</span>
            </p>
          </div>
        )}
        <div className="flex w-full space-x-4">
          <Button className="flex-1" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download Again
          </Button>
        </div>
        <Button variant="link" onClick={onStartOver}>
          Generate another report
        </Button>
      </CardContent>
    </Card>
  );
}
