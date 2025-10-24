
import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS for backend tasks (never expose this to the browser).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE env vars on server');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
