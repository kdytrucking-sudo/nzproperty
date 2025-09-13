'use client';

import {
  FileJson,
  FileText,
  MessageSquareQuote,
  ListTodo,
  Image,
  History,
  Pencil,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const settingsLinks = [
  {
    href: '/manage-content',
    label: 'Manage Content',
    description: 'Edit reusable global content blocks for reports.',
    icon: Pencil,
  },
  {
    href: '/manage-commentary',
    label: 'Manage Commentary',
    description: 'Configure cards with single-choice text options.',
    icon: MessageSquareQuote,
  },
  {
    href: '/manage-multi-option',
    label: 'Multi-Select',
    description: 'Configure cards with multiple-choice text options.',
    icon: ListTodo,
  },
  {
    href: '/manage-templates',
    label: 'Manage Templates',
    description: 'Upload and manage .docx report templates.',
    icon: FileText,
  },
  {
    href: '/manage-images',
    label: 'Manage Images',
    description: 'Define image placeholders and their dimensions.',
    icon: Image,
  },
  {
    href: '/manage-history',
    label: 'Manage History',
    description: 'View and delete saved drafts and replacement history.',
    icon: History,
  },
  {
    href: '/json-editor',
    label: 'AI Settings',
    description: 'Configure AI model, prompts, and data extraction rules.',
    icon: FileJson,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage all application configurations, content, and templates from one place.
        </p>
      </header>

      <main>
        <Card>
          <CardHeader>
            <CardTitle>Configuration Hub</CardTitle>
            <CardDescription>Select a category to manage its settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {settingsLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between p-4 -mx-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-secondary p-2 text-secondary-foreground">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
