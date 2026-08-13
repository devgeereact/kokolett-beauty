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

  it('shows nothing until a toast is fired', () => {
    renderWithProvider(<Harness />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a toast with its message, announced via role="status"', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Harness message="Booking cancelled." />);

    await user.click(screen.getByRole('button', { name: 'Fire toast' }));

    expect(screen.getByRole('status')).toHaveTextContent('Booking cancelled.');
  });

  it('auto-dismisses after the default 8s duration', () => {
    vi.useFakeTimers();
    renderWithProvider(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Fire toast' }));
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(7999);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('respects a custom duration', () => {
    vi.useFakeTimers();
    renderWithProvider(<Harness duration={2000} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fire toast' }));

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('dismisses immediately via the manual dismiss control', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Fire toast' }));
    expect(screen.getByRole('status')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('fires the action callback and dismisses when the action button is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProvider(<Harness action={{ label: 'Undo', onClick }} />);

    await user.click(screen.getByRole('button', { name: 'Fire toast' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('pauses auto-dismiss while hovered, and resumes once the pointer leaves', () => {
    vi.useFakeTimers();
    renderWithProvider(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Fire toast' }));

    const toast = screen.getByRole('status');
    fireEvent.mouseEnter(toast);

    // Well past the 8s default — still present because the pointer is over it.
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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

    await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(2));
    expect(screen.getByText('First.')).toBeInTheDocument();
    expect(screen.getByText('Second.')).toBeInTheDocument();
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
