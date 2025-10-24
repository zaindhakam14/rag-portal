
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { createClient as createSSR } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sessionKey = url.searchParams.get('sessionId') || '';

    if (!sessionKey) {
      return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
        status: 400, headers: { 'content-type': 'application/json' },
      });
    }

    const ssr = await createSSR();
    const { data: { user } } = await ssr.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'content-type': 'application/json' },
      });
    }

    const svc = createServiceClient();

    // Confirm the user owns this session
    const { data: s, error: sErr } = await svc
      .from('chat_sessions')
      .select('id, user_id')
      .eq('session_key', sessionKey)
      .single();

    if (sErr || !s || s.user_id !== user.id) {
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }

    // Fetch messages, oldest -> newest
    const { data: msgs, error: mErr } = await svc
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', s.id)
      .order('created_at', { ascending: true });

    if (mErr) {
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ messages: msgs ?? [] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unknown error' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}
