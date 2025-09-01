'use client';

import { useEditor, EditorContent, EditorProvider } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder'
import * as React from 'react';
import { Bold, Italic, Strikethrough, List, ListOrdered, Heading1, Heading2, Quote } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';

type EditorProps = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

const EditorToolbar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 rounded-t-md border border-b-0 border-input bg-card p-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={cn(editor.isActive('bold') ? 'bg-primary text-primary-foreground' : '')}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={cn(editor.isActive('italic') ? 'bg-primary text-primary-foreground' : '')}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={cn(editor.isActive('strike') ? 'bg-primary text-primary-foreground' : '')}
      >
        <Strikethrough className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-6" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={cn(editor.isActive('heading', { level: 1 }) ? 'bg-primary text-primary-foreground' : '')}
      >
        <Heading1 className="h-4 w-4" />
      </Button>
       <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={cn(editor.isActive('heading', { level: 2 }) ? 'bg-primary text-primary-foreground' : '')}
      >
        <Heading2 className="h-4 w-4" />
      </Button>
       <Separator orientation="vertical" className="h-6" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn(editor.isActive('bulletList') ? 'bg-primary text-primary-foreground' : '')}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cn(editor.isActive('orderedList') ? 'bg-primary text-primary-foreground' : '')}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={cn(editor.isActive('blockquote') ? 'bg-primary text-primary-foreground' : '')}
      >
        <Quote className="h-4 w-4" />
      </Button>
    </div>
  );
};

export const Editor = ({ content, onChange, placeholder }: EditorProps) => {
  const editor = useEditor({
    extensions: [
        StarterKit.configure({
            bulletList: {
                HTMLAttributes: {
                    class: 'list-disc list-inside',
                },
            },
            orderedList: {
                HTMLAttributes: {
                    class: 'list-decimal list-inside',
                },
            }
        }),
        Placeholder.configure({
            placeholder: placeholder || 'Start writing...',
        }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
        attributes: {
            class: 'min-h-[400px] w-full rounded-b-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        },
    },
  });

  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
        editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};
