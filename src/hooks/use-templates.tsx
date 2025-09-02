'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type Template = {
  id: string;
  name: string;
  dataUri: string; // The base64 data URI of the .docx file
  // The File object cannot be stored in localStorage, so we omit it from the stored type
};

type StoredTemplate = Omit<Template, 'file'>;

type TemplatesContextType = {
  templates: Template[];
  addTemplate: (template: Template & { file: File }) => void;
  removeTemplate: (id: string) => void;
  isLoaded: boolean;
};

const TemplatesContext = createContext<TemplatesContextType | undefined>(undefined);

// Helper function to convert a File to a Template object
const fileToTemplate = (file: File, callback: (template: Template & { file: File }) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        const newTemplate: Template & { file: File } = {
            id: `template-${Date.now()}`,
            name: file.name,
            dataUri: dataUri,
            file: file,
        };
        callback(newTemplate);
    };
    reader.readAsDataURL(file);
};


export const TemplatesProvider = ({ children }: { children: ReactNode }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
        const storedTemplatesJSON = localStorage.getItem('docx-templates');
        if (storedTemplatesJSON) {
            const storedTemplates: StoredTemplate[] = JSON.parse(storedTemplatesJSON);
            // We can't reconstruct the File object, but we have the dataUri
            const loadedTemplates = storedTemplates.map(t => ({...t, file: new File([], t.name)}));
            setTemplates(loadedTemplates);
        }
    } catch (error) {
        console.error("Failed to load templates from localStorage", error);
    }
    setIsLoaded(true);
  }, []);

  const saveTemplatesToLocalStorage = (templatesToSave: Template[]) => {
     try {
        // Omit the 'file' property before saving
        const storableTemplates: StoredTemplate[] = templatesToSave.map(({ file, ...rest }) => rest);
        localStorage.setItem('docx-templates', JSON.stringify(storableTemplates));
     } catch (error) {
        console.error("Failed to save templates to localStorage", error);
     }
  };

  const addTemplate = (template: Template) => {
    const newTemplates = [...templates, template];
    setTemplates(newTemplates);
    saveTemplatesToLocalStorage(newTemplates);
  };

  const removeTemplate = (id: string) => {
    const newTemplates = templates.filter((t) => t.id !== id);
    setTemplates(newTemplates);
    saveTemplatesToLocalStorage(newTemplates);
  };

  return (
    <TemplatesContext.Provider value={{ templates, addTemplate, removeTemplate, isLoaded }}>
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

export { fileToTemplate };
