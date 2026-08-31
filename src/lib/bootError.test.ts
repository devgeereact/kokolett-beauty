import { beforeEach, describe, expect, it } from 'vitest';
import { renderBootError } from '@/lib/bootError';

/**
 * `missingBootConfig` reads a module-scope frozen `env`, so it cannot be
 * meaningfully re-tested per case without stubbing the import. What matters and
 * is testable is the other half: that the fallback renders something a person
 * can act on, and that it never prints a credential.
 */

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  root = document.createElement('div');
  document.body.appendChild(root);
});

describe('renderBootError', () => {
  it('names each missing variable', () => {
    renderBootError(root, ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']);
    const text = root.innerText || root.textContent || '';
    expect(text).toContain('VITE_SUPABASE_URL');
    expect(text).toContain('VITE_SUPABASE_ANON_KEY');
  });

  it('renders something rather than nothing, which is the whole point', () => {
    renderBootError(root, ['VITE_SUPABASE_URL']);
    expect((root.textContent ?? '').trim().length).toBeGreaterThan(20);
  });

  it('is announced to a screen reader', () => {
    renderBootError(root, ['VITE_SUPABASE_URL']);
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('agrees with itself about how many are missing', () => {
    renderBootError(root, ['VITE_SUPABASE_URL']);
    expect(root.textContent).toContain('One required setting is missing');

    renderBootError(root, ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']);
    expect(root.textContent).toContain('2 required settings are missing');
  });

  it('replaces whatever was there rather than appending to it', () => {
    root.innerHTML = '<p>stale</p>';
    renderBootError(root, ['VITE_SUPABASE_URL']);
    expect(root.textContent).not.toContain('stale');
  });

  it('builds the DOM rather than assigning markup', () => {
    // The variable names are ours, not user input, but this path runs when the
    // app is already broken and is exactly where an innerHTML habit survives.
    renderBootError(root, ['<img src=x onerror=alert(1)>']);
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
