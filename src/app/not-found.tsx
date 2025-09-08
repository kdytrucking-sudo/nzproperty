
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-9xl font-bold tracking-tighter text-primary/20">404</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Sorry, the page you are looking for does not exist.
        </p>
        <Button asChild className="mt-8">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
