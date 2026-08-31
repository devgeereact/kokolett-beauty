import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

export function NotFoundPage(): JSX.Element {
  /* `noindex` so a mistyped or retired URL never enters the index as a real
     page. `follow` is kept: the links out of it are still worth crawling. */
  useDocumentMeta({ title: 'Page not found', noindex: true });
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-serif text-7xl font-extrabold text-primary">404</p>
        <p className="mt-2 mb-8 text-muted-foreground">This page doesn't exist.</p>
        <Link to="/">
          <Button>Back home</Button>
        </Link>
      </div>
    </main>
  );
}
