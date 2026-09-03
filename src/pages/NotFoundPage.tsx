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
        {/* Decoration. The numeral carried the whole page before, as a <p>, so
            this screen had no h1 at all and a screen reader announced it as
            "404 This page doesn't exist" with no document heading to land on.
            It also renders for a signed-out hit on a dashboard route
            (ProtectedRoute), which makes it a page the owner sees, not only a
            stranger. The wording stays generic for that reason. */}
        <p aria-hidden="true" className="font-serif text-7xl font-extrabold text-primary">
          404
        </p>
        <h1 className="mt-2 mb-8 text-muted-foreground">This page doesn't exist.</h1>
        <Link to="/">
          <Button>Back home</Button>
        </Link>
      </div>
    </main>
  );
}
