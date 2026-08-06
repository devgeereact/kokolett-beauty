import { useMemo } from 'react';
import { buildImageKitUrl, type ImageTransform } from '@/lib/imagekit';

/** Memoized ImageKit URL for a given path + transform. */
export function useOptimizedImage(path: string, transform?: ImageTransform): string {
  return useMemo(
    () => buildImageKitUrl(path, transform),
    // Depend on primitive fields (not the object identity) so a fresh
    // `transform` literal each render doesn't rebuild the URL needlessly.
    // The directive must sit on the deps array itself — Prettier reflows this
    // call, and a directive attached to `return` no longer covers the warning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, transform?.width, transform?.height, transform?.quality, transform?.crop],
  );
}
