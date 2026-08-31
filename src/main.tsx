import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initSentry } from '@/lib/sentry';
import { missingBootConfig, renderBootError } from '@/lib/bootError';
import '@/index.css';

// Schedules monitoring for after first paint — see src/lib/sentry.ts. Sentry
// used to be on the critical path of the booking flow at ~99 kB gzipped.
initSentry();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found in index.html');
}

const missing = missingBootConfig();

if (missing.length > 0) {
  // Never reached in a correctly configured deploy. See src/lib/bootError.ts
  // for why a blank page is the alternative.
  console.error(`Missing required configuration: ${missing.join(', ')}`);
  renderBootError(container, missing);
} else {
  /* Imported dynamically, and that is load-bearing rather than stylistic. A
     static `import { App }` is hoisted and evaluated before any statement in
     this file runs, and the module graph under it builds the Supabase client at
     module scope. `createClient` throws on an empty URL, so the guard above
     would never get to run: the page would still go blank, just with the check
     sitting uselessly beneath the crash. */
  const { App } = await import('@/App');
  const { ErrorBoundary } = await import('@/components/ErrorBoundary');

  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
