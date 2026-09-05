import type { JSX } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '@/context/ToastContext';

/** Fires a toast, with a configurable message/action, on button click. */
function Harness({
  message = 'Saved.',
  action,
  duration,
}: {
  message?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}): JSX.Element {
  const { showToast } = useToast();
  return (
    <button onClick={() => showToast({ message, action, duration })}>Fire toast</button>
  );
}

function renderWithProvider(ui: JSX.Element): ReturnType<typeof render> {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('Toast / ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows no toast card until one is fired', () => {
    renderWithProvider(<Harness />);
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  /* The live region is the fix, so it gets its own assertion. It has to be in
     the DOM BEFORE the message arrives: assistive technology announces
     mutations to a region it was already watching, and a region that mounts
     carrying its text is not reliably announced at all. Every dashboard
     confirmation goes through here, including the Undo affordance that then
     times out after 8s. */
  it('keeps an empty live region mounted before any toast exists', () => {
    renderWithProvider(<Harness />);
    const live = screen.getByRole('status');
    expect(live).toBeInTheDocument();
    expect(live).toBeEmptyDOMElement();
  });

  it('writes the message into that same region rather than mounting a new one', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Harness message="Booking cancelled." />);

    const live = screen.getByRole('status');
    await user.click(screen.getByRole('button', { name: 'Fire toast' }));

    expect(screen.getByRole('status')).toBe(live);
    expect(live).toHaveTextContent('Booking cancelled.');
  });

  it('shows a toast card with its message', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Harness message="Booking cancelled." />);

    await user.click(screen.getByRole('button', { name: 'Fire toast' }));

    expect(screen.getByTestId('toast')).toHaveTextContent('Booking cancelled.');
  });

  it('auto-dismisses after the default 8s duration', () => {
    vi.useFakeTimers();
    renderWithProvider(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Fire toast' }));
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(7999);
    });
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('respects a custom duration', () => {
    vi.useFakeTimers();
    renderWithProvider(<Harness duration={2000} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fire toast' }));

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('dismisses immediately via the manual dismiss control', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Fire toast' }));
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('fires the action callback and dismisses when the action button is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProvider(<Harness action={{ label: 'Undo', onClick }} />);

    await user.click(screen.getByRole('button', { name: 'Fire toast' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('pauses auto-dismiss while hovered, and resumes once the pointer leaves', () => {
    vi.useFakeTimers();
    renderWithProvider(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Fire toast' }));

    const toast = screen.getByTestId('toast');
    fireEvent.mouseEnter(toast);

    // Well past the 8s default — still present because the pointer is over it.
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('pauses auto-dismiss while a control inside it has keyboard focus, and resumes on blur', () => {
    // Same pause/resume mechanism as hover, but via the onFocus/onBlur path —
    // real DOM .focus()/.blur() (not fireEvent.focus, which doesn't bubble
    // the way a genuine focus shift does) so the toast's onFocus/onBlur
    // handler actually receives it, the way tabbing onto the Dismiss button
    // would in the browser.
    vi.useFakeTimers();
    renderWithProvider(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Fire toast' }));

    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    dismissButton.focus();
    expect(dismissButton).toHaveFocus();

    // Well past the 8s default — still present because a control inside it is focused.
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    dismissButton.blur();
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('stacks multiple toasts instead of one replacing the other', async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <>
        <Harness message="First." />
        <Harness message="Second." />
      </>,
    );

    await user.click(screen.getAllByRole('button', { name: 'Fire toast' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Fire toast' })[1]!);

    // Two cards, but still exactly ONE live region: the region is the
    // announcer and both messages are written into it, rather than each toast
    // mounting a region of its own.
    await waitFor(() => expect(screen.getAllByTestId('toast')).toHaveLength(2));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('First.');
    expect(screen.getByRole('status')).toHaveTextContent('Second.');
    expect(screen.getAllByText('First.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Second.').length).toBeGreaterThan(0);
  });

  it('throws a clear error when useToast is used outside a ToastProvider', () => {
    // Swallow the expected React error-boundary console noise for this one case.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow(
      'useToast must be used within a <ToastProvider>.',
    );
    spy.mockRestore();
  });
});
