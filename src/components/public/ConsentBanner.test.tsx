import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConsentBanner } from '@/components/public/ConsentBanner';
import { analyticsAllowed, resetConsentStore, setConsent } from '@/lib/consent';

function renderBanner(): void {
  render(
    <MemoryRouter>
      <ConsentBanner />
    </MemoryRouter>,
  );
}

const accept = (): HTMLElement =>
  screen.getByRole('button', { name: /yes, that is fine/i });
const reject = (): HTMLElement => screen.getByRole('button', { name: /no thanks/i });

describe('ConsentBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetConsentStore();
  });

  it('appears while the visitor is undecided', () => {
    renderBanner();
    expect(screen.getByRole('region', { name: /cookies and storage/i })).toBeVisible();
  });

  it('offers accepting and refusing as equal controls', () => {
    renderBanner();
    // Both are real buttons, not a button next to a text link. Same component,
    // same size: refusing must not be made harder than agreeing.
    expect(accept().tagName).toBe('BUTTON');
    expect(reject().tagName).toBe('BUTTON');
    // Same size class, so neither is visually demoted into a hard-to-find link.
    expect(accept().className).toContain('h-control-lg');
    expect(reject().className).toContain('h-control-lg');
  });

  it('records a yes and disappears', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(accept());
    expect(analyticsAllowed()).toBe(true);
    expect(screen.queryByRole('region', { name: /cookies and storage/i })).toBeNull();
  });

  it('records a no, disappears, and grants nothing', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(reject());
    expect(analyticsAllowed()).toBe(false);
    expect(screen.queryByRole('region', { name: /cookies and storage/i })).toBeNull();
  });

  it('stays away once a decision exists', () => {
    setConsent(false);
    renderBanner();
    expect(screen.queryByRole('region', { name: /cookies and storage/i })).toBeNull();
  });

  it('links to the page explaining what is stored', () => {
    renderBanner();
    expect(screen.getByRole('link', { name: /what we store/i })).toHaveAttribute(
      'href',
      '/cookies',
    );
  });
});
