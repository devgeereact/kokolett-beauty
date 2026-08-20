import { type JSX, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog, type ConfirmDialogProps } from '@/components/ui/ConfirmDialog';

/**
 * `ConfirmDialog` is boolean-controlled by its parent (like `NewBookingPanel`),
 * not a self-managing imperative dialog — so most of these tests drive it
 * through a small harness that owns `open` state and a real trigger button,
 * exactly like a real call site will.
 */
function Harness(props: Partial<ConfirmDialogProps> = {}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open trigger</button>
      <ConfirmDialog
        open={open}
        title="Cancel this booking?"
        message="The customer will be notified. This cannot be undone."
        tone="destructive"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        {...props}
      />
    </div>
  );
}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Title"
        message="Message"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders the title, message and default labels as an alertdialog when open', () => {
    render(
      <ConfirmDialog
        open
        title="Cancel this booking?"
        message="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Cancel this booking?' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('preserves paragraph breaks in the message (e.g. the GDPR erase / week-replace copy)', () => {
    // Mirrors the real window.confirm strings this replaces — CustomersPage's
    // erase warning and WeeklyDefaultPage's week-replace warning both embed a
    // literal `\n\n` for a paragraph break that window.confirm renders
    // natively. Without `whitespace-pre-line` on the message <p>, that
    // collapses into a run-on sentence.
    const message =
      "Erase Jane Doe's personal details?\n\nTheir appointment history stays for your records, but their contact details and notes are removed.";
    render(
      <ConfirmDialog
        open
        title="Erase this customer?"
        message={message}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const description = screen.getByText(/Erase Jane Doe/);
    expect(description.className).toMatch(/whitespace-pre-line/);
    // textContent carries the raw string (including the embedded newlines)
    // regardless of CSS — this is the actual source-of-truth check that the
    // paragraph break survived the round trip into the DOM. (Not asserted via
    // jest-dom's toHaveTextContent: it normalises whitespace by default,
    // which would collapse the very `\n\n` this test exists to catch.)
    expect(description.textContent).toBe(message);
  });

  it('uses the destructive Button variant for the confirm action when tone is destructive', () => {
    render(
      <ConfirmDialog
        open
        title="Delete customer?"
        message="This cannot be undone."
        tone="destructive"
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Delete' }).className).toMatch(
      /bg-destructive/,
    );
  });

  it('uses the primary Button variant for the confirm action by default', () => {
    render(
      <ConfirmDialog
        open
        title="Proceed?"
        message="Are you sure?"
        confirmLabel="Proceed"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Proceed' }).className).toMatch(
      /bg-primary/,
    );
  });

  it('fires onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Title"
        message="Message"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('fires onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Title"
        message="Message"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('fires onCancel when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Title"
        message="Message"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('closes on Escape, equivalent to Cancel', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open trigger' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('moves focus into the dialog on open, and back to the trigger on close', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Open trigger' });
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
  });

  it('keeps Tab focus cycling inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open trigger' }));

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(cancel).toHaveFocus();

    // Shift+Tab from the first focusable wraps to the last.
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();

    // Tab from the last focusable wraps back to the first.
    await user.tab();
    expect(cancel).toHaveFocus();
  });

  it('activates the focused confirm button on Enter (native button behaviour)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Title"
        message="Message"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    await user.tab(); // Cancel -> Confirm
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
