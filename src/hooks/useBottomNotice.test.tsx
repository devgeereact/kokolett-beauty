import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  resetBottomNotices,
  useBottomNotice,
  type BottomLayer,
} from '@/hooks/useBottomNotice';

/** jsdom reports every element as 0-height, so the height is forced. */
function Notice({
  layer,
  height,
  visible = true,
}: {
  layer: BottomLayer;
  height: number;
  visible?: boolean;
}): React.JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);
  const bottom = useBottomNotice(layer, ref, visible);
  if (!visible) return null;
  return (
    <div
      ref={(node) => {
        if (node) Object.defineProperty(node, 'offsetHeight', { value: height });
        ref.current = node;
      }}
      data-testid={layer}
      data-bottom={bottom}
    />
  );
}

afterEach(resetBottomNotices);

/**
 * Consent and the offline banner were both `fixed bottom-0 z-toast`, so a
 * first visit while offline stacked one exactly on top of the other, and the
 * install prompt's `bottom-20` assumed whatever was below it was under 80px
 * tall. The stack is what stops both.
 */
describe('useBottomNotice', () => {
  it('puts the bottom-most layer on the edge', () => {
    render(<Notice layer="consent" height={120} />);
    expect(screen.getByTestId('consent').dataset.bottom).toBe(
      'calc(0px + env(safe-area-inset-bottom, 0px))',
    );
  });

  it('offsets a layer by the real height of the ones below it', () => {
    render(
      <>
        <Notice layer="consent" height={120} />
        <Notice layer="offline" height={44} />
        <Notice layer="toast" height={60} />
      </>,
    );
    expect(screen.getByTestId('offline').dataset.bottom).toBe(
      'calc(120px + env(safe-area-inset-bottom, 0px))',
    );
    // consent (120) + offline (44); `install` is not mounted and contributes 0.
    expect(screen.getByTestId('toast').dataset.bottom).toBe(
      'calc(164px + env(safe-area-inset-bottom, 0px))',
    );
  });

  it('ignores a layer that is not visible', () => {
    render(
      <>
        <Notice layer="consent" height={120} visible={false} />
        <Notice layer="offline" height={44} />
      </>,
    );
    expect(screen.getByTestId('offline').dataset.bottom).toBe(
      'calc(0px + env(safe-area-inset-bottom, 0px))',
    );
  });
});
