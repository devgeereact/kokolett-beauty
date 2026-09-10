/**
 * Does the built bundle contain anything from the env file that should not be
 * public?
 *
 * Vite inlines every `VITE_*` member `src/lib/env.ts` reads, and this repository
 * is public, so the prefix is a publication decision rather than a naming style
 * (`docs/RULES.md` §5). On 2026-09-10 a local `.env` briefly carried the ImageKit
 * private key as `VITE_IMAGEKIT_PRIVATE_KEY`, which is one `import.meta.env` read
 * away from shipping it to every visitor. This turns that into a failed command.
 *
 * Values are compared, never printed: the output names variables and files only.
 *
 * Local only, by design. CI builds without an env file (that is what catches a
 * missing variable), so with nothing to compare against this exits 0 and says so.
 *
 *   node scripts/check-bundle-secrets.mjs        # after `npm run build`
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, ['.', 'env'].join(''));
const DIST = path.join(ROOT, 'dist');

/**
 * The only values allowed to appear in `dist/`. Everything else in the env file
 * is either server-side or simply has no business being in a bundle.
 */
const PUBLISHABLE = new Set([
  'VITE_APP_NAME',
  'VITE_APP_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_IMAGEKIT_URL_ENDPOINT',
  'VITE_IMAGEKIT_PUBLIC_KEY',
  'VITE_SENTRY_DSN',
  'VITE_SALON_TIMEZONE',
  'VITE_SALON_CURRENCY',
  'VITE_SALON_PHONE',
  'VITE_SALON_EMAIL',
  'VITE_SALON_ADDRESS',
  'VITE_GOOGLE_REVIEW_URL',
  // The salon's own address, which the site prints on several pages. These two
  // share their value with VITE_SALON_EMAIL, so they match wherever it does.
  'SMTP_FROM_EMAIL',
  'SMTP_FROM_NAME',
  'KOKO_OWNER_EMAIL',
]);

/** Short values match too much ordinary text to be evidence of anything. */
const MIN_LENGTH = 8;

if (!existsSync(ENV_FILE)) {
  console.log('bundle-secret check: no env file, nothing to compare (this is normal in CI)');
  process.exit(0);
}
if (!existsSync(DIST)) {
  console.error('bundle-secret check: no dist/ — run `npm run build` first');
  process.exit(1);
}

const vars = [];
for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
  const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
  if (!m) continue;
  const value = m[2].trim().replace(/^["']|["']$/g, '');
  if (value.length >= MIN_LENGTH) vars.push({ name: m[1], value });
}

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(js|mjs|html|css|webmanifest|json|map)$/.test(entry)) files.push(full);
  }
})(DIST);

const leaked = new Map();
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const { name, value } of vars) {
    if (PUBLISHABLE.has(name) || !text.includes(value)) continue;
    const where = leaked.get(name) ?? [];
    where.push(path.relative(DIST, file));
    leaked.set(name, where);
  }
}

if (leaked.size === 0) {
  console.log(
    `bundle-secret check: ${files.length} built files carry none of the ` +
      `${vars.length - PUBLISHABLE.size} non-publishable values in the env file`,
  );
  process.exit(0);
}

console.error('bundle-secret check FAILED. These values are in the build:');
for (const [name, where] of leaked) {
  console.error(`  ${name} -> ${where.slice(0, 5).join(', ')}`);
}
console.error(
  'Either the variable is misnamed (a server-side secret must not carry the VITE_ ' +
    'prefix, docs/RULES.md §5) or something in src/ reads it. Do not deploy this build.',
);
process.exit(1);
