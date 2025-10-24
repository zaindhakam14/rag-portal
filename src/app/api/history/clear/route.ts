
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { createClient as createSSR } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
        status: 400, headers: { 'content-type': 'application/json' },
      });
    }

    // Auth: who is calling?
    const ssr = await createSSR();
    const { data: { user } } = await ssr.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'content-type': 'application/json' },
      });
    }

    const svc = createServiceClient();

    // Verify the user owns this session
    const { data: s, error: sErr } = await svc
      .from('chat_sessions')
      .select('id, user_id')
      .eq('session_key', sessionId)
      .single();

    if (sErr || !s || s.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: { 'content-type': 'application/json' },
      });
    }

    // Delete all messages for that session
    await svc.from('chat_messages').delete().eq('session_id', s.id);

    // Optionally reset the session title + timestamps
    await svc.from('chat_sessions')
      .update({ title: 'New chat', updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
      .eq('id', s.id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unknown error' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}
