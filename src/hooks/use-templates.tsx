'use client';

// This hook is deprecated and all logic has been moved to the page components
// that interact with server-side flows for template management.
// This file is kept to avoid breaking imports but should not be used.

import React, { createContext, useContext } from 'react';

export type Template = {
  id: string;
  name: string;
  dataUri: string;
};

type TemplatesContextType = {
  templates: Template[];
  addTemplate: (template: Template) => void;
  removeTemplate: (id: string) => void;
  isLoaded: boolean;
};

const TemplatesContext = createContext<TemplatesContextType | undefined>(undefined);

export const TemplatesProvider = ({ children }: { children: React.ReactNode }) => {
  const contextValue = {
    templates: [],
    addTemplate: () => console.warn("useTemplates hook is deprecated."),
    removeTemplate: () => console.warn("useTemplates hook is deprecated."),
    isLoaded: true,
  };

  return (
    <TemplatesContext.Provider value={contextValue}>
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
