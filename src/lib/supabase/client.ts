
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Session } from '@supabase/supabase-js';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Sync auth state to the server so SSR can see you're logged in
    client.auth.onAuthStateChange(async (event, session: Session | null) => {
      try {
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ event, session }),
        });
      } catch (err) {
        console.error('auth/callback failed', err);
      }
    });
  }
  return client;
}
