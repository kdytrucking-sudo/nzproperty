'use client';

import * as React from 'react';
import { Step1Input } from '@/components/generate-report/step-1-input';
import { Step2Review } from '@/components/generate-report/step-2-review';
import { Step3Result } from '@/components/generate-report/step-3-result';
import type { PropertyData } from '@/lib/types';
import { AnimatePresence, motion } from 'framer-motion';

function GenerateReportFlow() {
  const [step, setStep] = React.useState<Step>('input');
  const [propertyData, setPropertyData] = React.useState<PropertyData | null>(null);
  const [generatedReportDataUri, setGeneratedReportDataUri] = React.useState<string | null>(null);
  const [generatedFileName, setGeneratedFileName] = React.useState<string>('');
  const [replacementsCount, setReplacementsCount] = React.useState(0);


  const handleDataExtracted = (data: PropertyData) => {
    setPropertyData(data);
    setStep('review');
  };

  const handleReportGenerated = (reportDataUri: string, count: number) => {
    const address = propertyData?.propertyDetails?.address || 'Report';
    const date = new Date().toISOString().split('T')[0];
    const fileName = `${address} - ${date}.docx`;

    setGeneratedReportDataUri(reportDataUri);
    setGeneratedFileName(fileName);
    setReplacementsCount(count);
    setStep('result');
  };

  const handleStartOver = () => {
    setPropertyData(null);
    setGeneratedReportDataUri(null);
    setGeneratedFileName('');
    setReplacementsCount(0);
    setStep('input');
  };

  const handleBackToInput = () => {
    setStep('input');
  }
  
  type Step = 'input' | 'review' | 'result';

  const variants = {
    enter: { opacity: 0, y: 20 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">
          Welcome, Alex!
        </h1>
        <p className="text-muted-foreground">
          Your professional property valuation report generator.
        </p>
      </header>
      
      <main>
        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div
              key="input"
              initial="enter"
              animate="center"
              exit="exit"
              variants={variants}
              transition={{ duration: 0.3 }}
            >
              <Step1Input onDataExtracted={handleDataExtracted} />
            </motion.div>
          )}

          {step === 'review' && propertyData && (
             <motion.div
              key="review"
              initial="enter"
              animate="center"
              exit="exit"
              variants={variants}
              transition={{ duration: 0.3 }}
            >
              <Step2Review 
                extractedData={propertyData} 
                onReportGenerated={handleReportGenerated}
                onBack={handleBackToInput}
              />
            </motion.div>
          )}

          {step === 'result' && generatedReportDataUri && (
             <motion.div
              key="result"
              initial="enter"
              animate="center"
              exit="exit"
              variants={variants}
              transition={{ duration: 0.3 }}
            >
              <Step3Result 
                reportDataUri={generatedReportDataUri}
                fileName={generatedFileName}
                onStartOver={handleStartOver} 
                replacementsCount={replacementsCount}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function GenerateReportPage() {
    return (
        <GenerateReportFlow />
    )
}
