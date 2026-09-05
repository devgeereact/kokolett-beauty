import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '@/components/ui/Tooltip';

describe('Tooltip', () => {
  it('shows on focus and describes the control it wraps', async () => {
    render(
      <Tooltip label="Collapse the sidebar">
        <button type="button" aria-label="Collapse" />
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Collapse' });

    await userEvent.tab();
    expect(button).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Collapse the sidebar');
    expect(button).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
  });

  /**
   * It used to overwrite `aria-describedby` outright, so wrapping a control
   * that already pointed at a hint silently deleted the hint.
   */
  it('keeps a description the child already had', async () => {
    render(
      <>
        <p id="existing-hint">Only the owner can see this.</p>
        <Tooltip label="Collapse the sidebar">
          <button type="button" aria-label="Collapse" aria-describedby="existing-hint" />
        </Tooltip>
      </>,
    );
    const button = screen.getByRole('button', { name: 'Collapse' });
    expect(button).toHaveAttribute('aria-describedby', 'existing-hint');

    await userEvent.tab();
    const describedBy = button.getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ')).toContain('existing-hint');
    expect(describedBy.split(' ')).toContain(screen.getByRole('tooltip').id);
  });

  /** WCAG 1.4.13: content shown on hover or focus must be dismissable. */
  it('dismisses on Escape without moving focus', async () => {
    render(
      <Tooltip label="Collapse the sidebar">
        <button type="button" aria-label="Collapse" />
      </Tooltip>,
    );
    await userEvent.tab();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse' })).toHaveFocus();
  });
});
