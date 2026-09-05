import { useEffect, useState, type RefObject } from 'react';

/**
 * The bottom edge of the screen, shared out between the four things that can
 * claim it.
 *
 * All four were pinned there independently: `ConsentBanner` and
 * `OfflineBanner` both at `bottom-0 z-toast` (so on a first visit while
 * offline one sat exactly on top of the other), `InstallPrompt` at a
 * hard-coded `bottom-20` that assumed whatever was below it was under 80px
 * tall, and `ToastStack` at `bottom-4`/`bottom-6` regardless of what else
 * was showing. Any two of them at once obscured the third, and on a phone
 * they obscured the page's own final action.
 *
 * Each notice registers its measured height under its layer name; a layer's
 * offset is the sum of the heights of the layers below it. Heights are
 * measured with a `ResizeObserver`, so a banner that wraps to three lines on
 * a 320px screen pushes the ones above it by the height it actually has
 * rather than the height someone assumed.
 *
 * Order, bottom-most first: consent is the most persistent and the one a
 * visitor must answer, so it holds the edge; offline sits above it; the
 * install invitation above that; toasts, which are transient and the most
 * urgent, sit on top of the lot.
 */
export const BOTTOM_LAYERS = ['consent', 'offline', 'install', 'toast'] as const;

export type BottomLayer = (typeof BOTTOM_LAYERS)[number];

const heights = new Map<BottomLayer, number>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function setHeight(layer: BottomLayer, height: number): void {
  if (heights.get(layer) === height) return;
  heights.set(layer, height);
  emit();
}

function offsetFor(layer: BottomLayer): number {
  const index = BOTTOM_LAYERS.indexOf(layer);
  let total = 0;
  for (let i = 0; i < index; i += 1) {
    const below = BOTTOM_LAYERS[i];
    if (below) total += heights.get(below) ?? 0;
  }
  return total;
}

/** Exported for tests: forget every registered height. */
export function resetBottomNotices(): void {
  heights.clear();
  emit();
}

/**
 * Registers `ref`'s height under `layer` while `visible`, and returns the
 * `bottom` value that layer should sit at — the stack below it plus the
 * device's own home-indicator inset.
 *
 * The return value is a CSS length string for an inline `style`, which is
 * what AGENTS.md §3 allows `style={{ }}` for: geometry that is genuinely
 * computed at runtime and cannot be a utility class.
 */
export function useBottomNotice(
  layer: BottomLayer,
  ref: RefObject<HTMLElement | null>,
  visible: boolean,
): string {
  const [offset, setOffset] = useState(() => offsetFor(layer));

  useEffect(() => {
    const update = (): void => setOffset(offsetFor(layer));
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, [layer]);

  useEffect(() => {
    if (!visible) {
      setHeight(layer, 0);
      return undefined;
    }
    const element = ref.current;
    if (!element) return undefined;

    setHeight(layer, element.offsetHeight);
    /* jsdom has no ResizeObserver, and neither did Safari before 13.1. The
       height measured above is still registered either way; only live
       re-measurement is lost. */
    if (typeof ResizeObserver === 'undefined') return () => setHeight(layer, 0);

    const observer = new ResizeObserver(() => setHeight(layer, element.offsetHeight));
    observer.observe(element);
    return () => {
      observer.disconnect();
      setHeight(layer, 0);
    };
  }, [layer, ref, visible]);

  return `calc(${offset}px + env(safe-area-inset-bottom, 0px))`;
}
