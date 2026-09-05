import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown } from '@/components/ui/Dropdown';

function renderMenu(onEdit = vi.fn()): { onEdit: ReturnType<typeof vi.fn> } {
  render(
    <Dropdown
      label="Row actions"
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle}>
          More options
        </button>
      )}
      items={[
        { key: 'edit', label: 'Edit', onSelect: onEdit },
        { key: 'export', label: 'Export', onSelect: vi.fn(), disabled: true },
        { key: 'delete', label: 'Delete', onSelect: vi.fn(), destructive: true },
      ]}
    />,
  );
  return { onEdit };
}

/**
 * The menu announced itself as a menu and then behaved like a row of
 * buttons: opening left focus on the trigger, so a screen reader read
 * nothing, and the arrow keys did nothing at all.
 */
describe('Dropdown keyboard behaviour', () => {
  it('moves focus to the first enabled item on open', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
  });

  it('skips disabled items when arrowing', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'More options' }));

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
  });

  it('closes on Escape and puts focus back on the trigger', async () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'More options' });
    await userEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('runs the chosen action and returns focus', async () => {
    const { onEdit } = renderMenu();
    const trigger = screen.getByRole('button', { name: 'More options' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });
});
