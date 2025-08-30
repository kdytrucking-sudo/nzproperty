import { Building } from 'lucide-react';
import * as React from 'react';

export function Logo() {
  return (
    <div className="flex items-center justify-center gap-2 text-sidebar-foreground transition-colors group-hover:text-sidebar-accent-foreground">
      <Building className="size-6 shrink-0 text-primary group-hover:text-sidebar-primary" />
      <div className="flex flex-col items-start">
        <span className="font-headline text-lg font-semibold leading-none tracking-tight">
          NZ Property Ace
        </span>
      </div>
    </div>
  );
}
