export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { createClient as createSSR } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/** GET: return messages for a session (oldest → newest) */
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
    const { data: s } = await svc
      .from('chat_sessions')
      .select('id, user_id')
      .eq('session_key', sessionKey)
      .single();

    if (!s || s.user_id !== user.id) {
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }

    const { data: msgs } = await svc
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', s.id)
      .order('created_at', { ascending: true });

    return new Response(JSON.stringify({ messages: msgs ?? [] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unknown error' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}

/** DELETE: clear chat.
 * mode=reset (default): delete session + messages, create a new session, return its sessionId
 * mode=truncate: delete only messages, keep the same sessionId
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sessionKey = url.searchParams.get('sessionId') || '';
    const mode = url.searchParams.get('mode') || 'reset';

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

    // Load the session & validate ownership
    const { data: s, error: sErr } = await svc
      .from('chat_sessions')
      .select('id, user_id, account_id, session_key')
      .eq('session_key', sessionKey)
      .single();

    if (sErr || !s || s.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: { 'content-type': 'application/json' },
      });
    }

    if (mode === 'truncate') {
      // Delete only messages, keep session id
      await svc.from('chat_messages').delete().eq('session_id', s.id);
      await svc
        .from('chat_sessions')
        .update({
          title: 'New chat',
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', s.id);

      return new Response(JSON.stringify({ ok: true, sessionId: s.session_key }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }

    // Default: reset — remove session (cascade messages) and create a fresh one
    await svc.from('chat_sessions').delete().eq('id', s.id);

    const slug = s.session_key.includes(':') ? s.session_key.split(':')[0] : 'demo-account';
    const newKey = `${slug}:${crypto.randomUUID().replace(/-/g, '')}`;

    const { data: created } = await svc
      .from('chat_sessions')
      .insert({
        account_id: s.account_id,
        user_id: user.id,
        session_key: newKey,
        title: 'New chat',
      })
      .select('session_key')
      .single();

    return new Response(JSON.stringify({ ok: true, sessionId: created?.session_key ?? newKey }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unknown error' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}
