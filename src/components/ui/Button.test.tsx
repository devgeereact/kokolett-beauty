import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('is disabled while loading', () => {
    render(<Button loading>Send</Button>);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  /**
   * The regression this file exists for. `disabled={disabled ?? loading}`
   * only fell through on null/undefined, so a call site combining
   * `loading={sending}` with `disabled={!canSend}` handed the button an
   * explicit `false` the moment its form went valid, and the button stayed
   * live for the whole request. Two clicks sent two emails.
   */
  it('stays disabled while loading even when the caller passes disabled={false}', async () => {
    const onClick = vi.fn();
    render(
      <Button loading disabled={false} onClick={onClick}>
        Send
      </Button>,
    );
    const button = screen.getByRole('button', { name: /send/i });
    expect(button).toBeDisabled();

    await userEvent.click(button).catch(() => {
      /* pointer-events: none on a disabled button is the point */
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('honours an explicit disabled when not loading', () => {
    render(<Button disabled>Send</Button>);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('is enabled when neither disabled nor loading', () => {
    render(<Button>Send</Button>);
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });
});
