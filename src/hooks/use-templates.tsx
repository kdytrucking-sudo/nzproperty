'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Template = {
  id: string;
  name: string;
  dataUri: string; // The base64 data URI of the .docx file
  file: File;
};

type TemplatesContextType = {
  templates: Template[];
  addTemplate: (template: Template) => void;
  removeTemplate: (id: string) => void;
};

const TemplatesContext = createContext<TemplatesContextType | undefined>(undefined);

export const TemplatesProvider = ({ children }: { children: ReactNode }) => {
  const [templates, setTemplates] = useState<Template[]>([]);

  const addTemplate = (template: Template) => {
    setTemplates((prev) => [...prev, template]);
  };

  const removeTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <TemplatesContext.Provider value={{ templates, addTemplate, removeTemplate }}>
      {children}
    </TemplatesContext.Provider>
  );
};

export const useTemplates = () => {
  const context = useContext(TemplatesContext);
  if (context === undefined) {
    throw new Error('useTemplates must be used within a TemplatesProvider');
  }
  return context;
};
