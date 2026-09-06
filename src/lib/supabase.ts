import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { env } from '@/lib/env';

/**
 * Singleton Supabase client, typed against the generated Database schema.
 * The anon key is safe in the browser because access is gated by RLS.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // needed for OAuth + magic-link redirects
    flowType: 'pkce',
  },
});

/**
 * Typed wrapper around `supabase.functions.invoke`.
 *
 * `FunctionsResponseFailure` declares `error: any`, so destructuring the raw
 * result taints every call site with an implicit `any` — which the lint rules
 * reject, correctly. Narrowing it once here means the Edge-Function services
 * stay fully typed instead of each disabling the rule.
 */
export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const result = (await supabase.functions.invoke<T>(name, { body })) as unknown as {
    data: T | null;
    error: { message?: string } | null;
  };

  if (result.error) {
    /* supabase-js reports every non-2xx as the same sentence, "Edge Function
       returned a non-2xx status code", and hides the function's own message
       on `error.context`, the raw Response. So the careful wording each
       function returns — "That is too long to draft from.", "The drafting
       service took too long." — never reached the owner, who saw only the
       generic line. Read the JSON body when there is one and prefer it. */
    const context = (result.error as { context?: unknown }).context;
    let fromFunction: string | null = null;
    if (context instanceof Response) {
      try {
        const payload = (await context.clone().json()) as { error?: unknown };
        if (typeof payload.error === 'string' && payload.error.trim() !== '') {
          fromFunction = payload.error;
        }
      } catch {
        // Not JSON, or the body was already consumed. Fall through to the
        // generic message rather than turning a parse failure into the error
        // the owner reads.
      }
    }
    if (fromFunction) throw new Error(fromFunction);
    throw new Error(
      result.error.message ?? `The ${name} function is unavailable right now.`,
    );
  }
  if (result.data === null || result.data === undefined) {
    throw new Error(`The ${name} function returned no data.`);
  }
  return result.data;
}
