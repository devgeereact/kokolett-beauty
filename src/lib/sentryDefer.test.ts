import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Monitoring is loaded after first paint so that ~88 kB gzipped of Sentry is
 * not on the critical path of a customer trying to book on a phone. The whole
 * risk of that trade is an error raised in the window before the SDK arrives,
 * so these tests pin the two behaviours that close it: an early report is
 * queued rather than dropped, and it pulls the load forward instead of
 * waiting for idle.
 */

const captureException = vi.fn();
const initSentryClient = vi.fn();

vi.mock('@/lib/env', () => ({
  env: {
    appUrl: 'https://www.kokolettbeauty.com',
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key-not-a-real-credential',
    imagekitUrlEndpoint: '',
    sentryDsn: 'https://abc123@o1.ingest.sentry.io/42',
    isProd: false,
    mode: 'test',
  },
}));

vi.mock('@/lib/sentry.client', () => ({ initSentryClient, captureException }));

/** Fresh module state per test — the shim caches the loaded client. */
async function freshSentry(): Promise<typeof import('@/lib/sentry')> {
  vi.resetModules();
  return import('@/lib/sentry');
}

beforeEach(() => {
  captureException.mockClear();
  initSentryClient.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deferred monitoring', () => {
  it('does not touch the SDK on import', async () => {
    await freshSentry();
    expect(initSentryClient).not.toHaveBeenCalled();
  });

  it('initSentry waits for idle rather than loading inline', async () => {
    const idle = vi.fn();
    vi.stubGlobal('requestIdleCallback', idle);

    const { initSentry } = await freshSentry();
    initSentry();

    expect(idle).toHaveBeenCalledOnce();
    expect(initSentryClient).not.toHaveBeenCalled();

    // Run whatever the browser would have run when it went idle.
    (idle.mock.calls[0]?.[0] as () => void)();
    await vi.waitFor(() => expect(initSentryClient).toHaveBeenCalledOnce());
  });

  it('queues an error raised before the SDK has loaded, then sends it', async () => {
    vi.stubGlobal('requestIdleCallback', undefined);

    const { reportError } = await freshSentry();
    const boom = new Error('booking failed');
    reportError(boom, { where: 'BookPage' });

    // Nothing lost while it loads, and the report itself triggers the load.
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledOnce());
    expect(initSentryClient).toHaveBeenCalledOnce();
    expect(captureException).toHaveBeenCalledWith(boom, { where: 'BookPage' });
  });

  it('sends straight through once the SDK is loaded', async () => {
    vi.stubGlobal('requestIdleCallback', undefined);

    const { reportError } = await freshSentry();
    reportError(new Error('first'));
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledOnce());

    reportError(new Error('second'));
    expect(captureException).toHaveBeenCalledTimes(2);
    expect(initSentryClient).toHaveBeenCalledOnce();
  });
});
