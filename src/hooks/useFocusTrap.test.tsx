import { type JSX, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/**
 * Escape must reach the innermost open trap and nothing else.
 *
 * `Modal` and `ConfirmDialog` both call this hook and both bind a keydown
 * listener to `document`. Neither stops the event, so before the trap stack a
 * single Escape fired every open handler: a ConfirmDialog opened from inside a
 * Modal closed the confirm AND the modal behind it. On the appointment editor
 * that meant changing your mind about a delete also threw away the note you
 * had just typed into the same modal.
 *
 * `stopImmediatePropagation()` cannot fix it. These are sibling listeners on
 * the same node, so dispatch order is registration order, and the outer panel
 * always registers first because it opened first. The order has to be decided
 * by the hook, not by the DOM.
 */
function Trap({
  open,
  onEscape,
  label,
}: {
  open: boolean;
  onEscape: () => void;
  label: string;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref, onEscape);
  return <div ref={ref}>{open ? <button type="button">{label}</button> : null}</div>;
}

describe('useFocusTrap: nesting', () => {
  it('Escape reaches only the trap that opened last', () => {
    const outer = vi.fn();
    const inner = vi.fn();

    render(
      <>
        <Trap open onEscape={outer} label="outer" />
        <Trap open onEscape={inner} label="inner" />
      </>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it('once the inner one closes, Escape reaches the outer one', () => {
    const outer = vi.fn();
    const inner = vi.fn();

    function Harness(): JSX.Element {
      const [innerOpen, setInnerOpen] = useState(true);
      return (
        <>
          <Trap open onEscape={outer} label="outer" />
          <Trap
            open={innerOpen}
            onEscape={() => {
              inner();
              setInnerOpen(false);
            }}
            label="inner"
          />
        </>
      );
    }

    render(<Harness />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    // The inner trap has unregistered itself, so the outer one is now topmost.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(outer).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('a single trap still responds to Escape', () => {
    const onEscape = vi.fn();
    render(<Trap open onEscape={onEscape} label="only" />);

    expect(screen.getByRole('button', { name: 'only' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('a closed trap never fires, and does not hold the top of the stack', () => {
    const closed = vi.fn();
    const open = vi.fn();

    render(
      <>
        <Trap open={false} onEscape={closed} label="closed" />
        <Trap open onEscape={open} label="open" />
      </>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(closed).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  });
});
