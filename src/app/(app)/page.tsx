'use client';

import * as React from 'react';
import { Step1Input } from '@/components/generate-report/step-1-input';
import { Step2Review } from '@/components/generate-report/step-2-review';
import { Step3ImageReplacement } from '@/components/generate-report/step-3-image-replacement';
import { Step4Result } from '@/components/generate-report/step-4-result';
import type { PropertyData } from '@/lib/types';
import { AnimatePresence, motion } from 'framer-motion';

type Step = 'input' | 'review' | 'image_replacement' | 'result';

function GenerateReportFlow() {
  const [step, setStep] = React.useState<Step>('input');
  const [propertyData, setPropertyData] = React.useState<PropertyData | null>(null);
  
  // State for intermediate file
  const [tempFileName, setTempFileName] = React.useState<string | null>(null);
  const [instructedBy, setInstructedBy] = React.useState<string | undefined>(undefined);

  // State for final result
  const [finalReportDataUri, setFinalReportDataUri] = React.useState<string | null>(null);
  const [finalFileName, setFinalFileName] = React.useState<string>('');
  const [replacementsCount, setReplacementsCount] = React.useState(0);


  const handleDataExtracted = (data: PropertyData) => {
    setPropertyData(data);
    setStep('review');
  };

  const handleTextReportGenerated = (tempFile: string, initialReplacements: number, instructedByValue: string | undefined) => {
    setTempFileName(tempFile);
    setReplacementsCount(initialReplacements); // Store initial count
    setInstructedBy(instructedByValue);
    setStep('image_replacement');
  };

  const handleImageReportGenerated = (finalUri: string, finalReplacements: number) => {
    const address = propertyData?.Info?.['Property Address'] || 'Report';
    const date = new Date().toISOString().split('T')[0];
    const fileName = `${address} - ${date}.docx`;

    setFinalReportDataUri(finalUri);
    setFinalFileName(fileName);
    setReplacementsCount(finalReplacements); // Update with final count
    setStep('result');
  }

  const handleStartOver = () => {
    setPropertyData(null);
    setTempFileName(null);
    setFinalReportDataUri(null);
    setFinalFileName('');
    setReplacementsCount(0);
    setInstructedBy(undefined);
    setStep('input');
  };

  const handleBackToInput = () => {
    setStep('input');
  }
  
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
                onReportGenerated={handleTextReportGenerated}
                onBack={handleBackToInput}
              />
            </motion.div>
          )}

          {step === 'image_replacement' && tempFileName && (
             <motion.div
              key="image_replacement"
              initial="enter"
              animate="center"
              exit="exit"
              variants={variants}
              transition={{ duration: 0.3 }}
            >
              <Step3ImageReplacement 
                tempFileName={tempFileName}
                initialReplacements={replacementsCount}
                onReportGenerated={handleImageReportGenerated}
                onBack={() => setStep('review')}
              />
            </motion.div>
          )}

          {step === 'result' && finalReportDataUri && (
             <motion.div
              key="result"
              initial="enter"
              animate="center"
              exit="exit"
              variants={variants}
              transition={{ duration: 0.3 }}
            >
              <Step4Result 
                reportDataUri={finalReportDataUri}
                fileName={finalFileName}
                onStartOver={handleStartOver} 
                replacementsCount={replacementsCount}
                debugInstructedBy={instructedBy}
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
