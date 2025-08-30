'use client';

import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { twMerge } from 'tailwind-merge';
import { Button } from './ui/button';

type FileUploaderProps = {
  value: File[] | null;
  onValueChange: (value: File[] | null) => void;
  options?: DropzoneOptions;
  maxFiles?: number;
  label: string;
};

export function FileUploader({
  value,
  onValueChange,
  options,
  maxFiles = 1,
  label,
}: FileUploaderProps) {
  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      onValueChange(acceptedFiles);
    },
    [onValueChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles,
    ...options,
  });

  const removeFile = (fileToRemove: File) => {
    if (!value) return;
    const newValue = value.filter((file) => file !== fileToRemove);
    onValueChange(newValue.length > 0 ? newValue : null);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div
        {...getRootProps()}
        className={twMerge(
          'group relative grid h-48 w-full cursor-pointer place-items-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-5 py-2.5 text-center transition hover:bg-muted/25',
          'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isDragActive && 'border-primary/50'
        )}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
            <UploadCloud className="size-8 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">Drop the files here</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
            <UploadCloud className="size-8 text-muted-foreground" />
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-primary">Click to upload</span> or drag and drop
              </p>
              {options?.accept && (
                <p className="text-xs">
                  Allowed types: {Object.values(options.accept).flat().join(', ')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {value && value.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {value.map((file, i) => (
            <div
              key={i}
              className="relative aspect-video overflow-hidden rounded-md border"
            >
              {file.type.startsWith('image/') ? (
                <Image
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center space-y-2 p-2">
                  <FileIcon className="size-8 text-muted-foreground" />
                  <p className="truncate text-xs text-muted-foreground">{file.name}</p>
                </div>
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6"
                onClick={() => removeFile(file)}
              >
                <X className="size-4" />
                <span className="sr-only">Remove file</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
