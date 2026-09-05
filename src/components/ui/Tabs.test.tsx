import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabPanel, Tabs } from '@/components/ui/Tabs';

type Key = 'one' | 'two' | 'three';

const TAB_ITEMS: { key: Key; label: string }[] = [
  { key: 'one', label: 'One' },
  { key: 'two', label: 'Two' },
  { key: 'three', label: 'Three' },
];

function Harness(): React.JSX.Element {
  const [active, setActive] = useState<Key>('one');
  return (
    <>
      <Tabs
        tabs={TAB_ITEMS}
        active={active}
        onChange={setActive}
        label="Example"
        idBase="example"
      />
      <TabPanel idBase="example" tabKey={active}>
        Panel {active}
      </TabPanel>
    </>
  );
}

/**
 * `Tabs` carried `role="tablist"`/`role="tab"` from the day it was extracted
 * and implemented none of what those roles promise. These are the four
 * promises, so a future edit cannot quietly take them away again.
 */
describe('Tabs keyboard behaviour', () => {
  it('keeps only the selected tab in the Tab order', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves and selects with the arrow keys, wrapping at the ends', async () => {
    render(<Harness />);
    const first = screen.getByRole('tab', { name: 'One' });
    first.focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus();
  });

  it('jumps to the ends with Home and End', async () => {
    render(<Harness />);
    screen.getByRole('tab', { name: 'One' }).focus();

    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus();

    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus();
  });

  it('points each tab at the panel it controls', async () => {
    render(<Harness />);
    const panel = screen.getByRole('tabpanel');
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute(
      'aria-controls',
      panel.id,
    );
    expect(panel).toHaveAccessibleName('One');

    await userEvent.click(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Two');
  });
});
