import { env } from '@/lib/env';

/**
 * A misconfigured environment must say so, not render nothing.
 *
 * `createClient` throws "supabaseUrl is required." when either Supabase
 * variable is empty, and it does that at module scope, before React mounts.
 * `ErrorBoundary` cannot catch it, because there is no tree yet. The result is
 * a completely blank page: correct HTML, correct title, empty body, one console
 * line nobody is looking at.
 *
 * `.env` is not committed, so this is the first thing a fresh environment hits,
 * and it is also what a deploy with one typo'd variable looks like. Losing an
 * hour to a white screen that a single sentence would have explained is a poor
 * trade for the six lines below.
 *
 * Names the missing variables, never their values. Naming a variable is how you
 * fix it; printing its value would put a credential in a screenshot.
 */
export function missingBootConfig(): string[] {
  const required: [string, string][] = [
    ['VITE_SUPABASE_URL', env.supabaseUrl],
    ['VITE_SUPABASE_ANON_KEY', env.supabaseAnonKey],
  ];
  return required.filter(([, value]) => !value).map(([name]) => name);
}

/**
 * Paints a plain, dependency-free message into the root element. Inline styles
 * on purpose: this runs when the app is known to be broken, so it must not
 * assume the stylesheet loaded or that any component can render.
 */
export function renderBootError(container: HTMLElement, missing: string[]): void {
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.setAttribute('role', 'alert');
  wrap.style.cssText =
    'max-width:34rem;margin:4rem auto;padding:0 1.5rem;' +
    'font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c2433';

  const heading = document.createElement('h1');
  heading.textContent = 'This site is not configured yet';
  heading.style.cssText = 'font-size:1.5rem;margin:0 0 .75rem';

  const lead = document.createElement('p');
  lead.style.cssText = 'margin:0 0 1rem';
  lead.textContent =
    missing.length === 1
      ? 'One required setting is missing, so the site cannot load its data.'
      : `${String(missing.length)} required settings are missing, so the site cannot load its data.`;

  const list = document.createElement('ul');
  list.style.cssText = 'margin:0 0 1rem;padding-left:1.25rem';
  for (const name of missing) {
    const item = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = name;
    code.style.cssText = 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace';
    item.appendChild(code);
    list.appendChild(item);
  }

  const help = document.createElement('p');
  help.style.cssText = 'margin:0;color:#5b6370';
  help.textContent =
    'If you are the owner, this is a deployment setting rather than anything you did. See docs/GO-LIVE.md.';

  wrap.append(heading, lead, list, help);
  container.appendChild(wrap);
}
