import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ServiceMenuGroup } from '@/types';

/**
 * One rule, and it is a product rule rather than a layout one: the per-style
 * duration chip appears only when the durations actually differ.
 *
 * All 44 live menu rows are 45 minutes, so the page printed "~45m" 44 times.
 * The number distinguished nothing, and putting the same one beside "Box
 * braids" and beside "Full colour" implied a precision the salon has not
 * committed to. It is derived from the data rather than switched off, so the
 * chips return on their own the day the owner gives one style its own length.
 */

vi.mock('@/hooks/useDocumentMeta', () => ({ useDocumentMeta: (): void => {} }));

vi.mock('@/components/public/SiteShell', () => ({
  SiteShell: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div>{children}</div>
  ),
}));

const menu = vi.hoisted(() => ({ groups: [] as ServiceMenuGroup[] }));
vi.mock('@/hooks/useServiceMenu', () => ({
  useServiceMenu: () => ({ groups: menu.groups, loading: false }),
}));

const { ServicesPage } = await import('@/pages/ServicesPage');

function item(name: string, duration_min: number): ServiceMenuGroup['items'][number] {
  return { name, note: null, duration_min, image_path: null };
}

function renderWith(groups: ServiceMenuGroup[]): void {
  menu.groups = groups;
  render(
    <MemoryRouter>
      <ServicesPage />
    </MemoryRouter>,
  );
}

describe('the service menu quotes a duration only when durations differ', () => {
  it('prints no duration when every style is the same length', () => {
    renderWith([
      { group_name: 'Braids', items: [item('Box braids', 45), item('Cornrows', 45)] },
      { group_name: 'Colour', items: [item('Full colour', 45)] },
    ]);

    expect(screen.getByText('Box braids')).toBeInTheDocument();
    expect(screen.getByText('Full colour')).toBeInTheDocument();
    expect(screen.queryByText(/45m/)).not.toBeInTheDocument();
  });

  it('prints every duration as soon as one style differs', () => {
    renderWith([
      { group_name: 'Braids', items: [item('Box braids', 45), item('Cornrows', 45)] },
      { group_name: 'Colour', items: [item('Full colour', 120)] },
    ]);

    expect(screen.getAllByText(/45m/)).toHaveLength(2);
    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });

  it('prints nothing when the menu is empty rather than a bare tilde', () => {
    renderWith([]);
    expect(screen.queryByText(/~/)).not.toBeInTheDocument();
  });
});
