// src/app/api/history/messages/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient as createSSR } from '@/lib/supabase/server';

function newSessionKey(prefix: string) {
  const seg = () => Math.random().toString(36).slice(2, 12); // a-z0-9 (10 chars)
  return `${prefix}:${seg()}${seg()}`;
}

async function getOwnedSession(
  ssr: SupabaseClient,
  sessionKey: string
): Promise<
  | { sessionRow: { id: string; account_id: string; user_id: string }; user: { id: string } }
  | { error: string; status: 401 | 403 | 404 }
> {
  const { data: authData, error: authErr } = await ssr.auth.getUser();
  if (authErr || !authData?.user) return { error: 'Unauthorized', status: 401 };

  const { data: sessionRow, error: sErr } = await ssr
    .from('chat_sessions')
    .select('id, account_id, user_id')
    .eq('session_key', sessionKey)
    .single();

  if (sErr || !sessionRow) return { error: 'Session not found', status: 404 };
  if (sessionRow.user_id !== authData.user.id) return { error: 'Forbidden', status: 403 };

  return { sessionRow, user: { id: authData.user.id } };
}

/** GET /api/history/messages?sessionId=... */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionKey = searchParams.get('sessionId') ?? '';
    if (!sessionKey || !sessionKey.includes(':')) {
      return NextResponse.json({ error: 'Missing or invalid sessionId' }, { status: 400 });
    }

    // IMPORTANT: await the server client factory
    const ssr = (await createSSR()) as SupabaseClient;

    const owned = await getOwnedSession(ssr, sessionKey);
    if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const { data: rows, error: mErr } = await ssr
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', owned.sessionRow.id)
      .order('created_at', { ascending: true });

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    const messages =
      rows?.map((r: any) => ({
        role: r.role,
        preview: (r.content ?? '').slice(0, 240),
        created_at: r.created_at,
      })) ?? [];

    return NextResponse.json(messages, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/history/messages?sessionId=...&mode=reset|clear
 * - reset (default): create a fresh session and return { sessionId }
 * - clear|purge|delete: delete all messages in current session, return { ok, sessionId }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionKey = searchParams.get('sessionId') ?? '';
    const mode = (searchParams.get('mode') ?? 'reset').toLowerCase();

    if (!sessionKey || !sessionKey.includes(':')) {
      return NextResponse.json({ error: 'Missing or invalid sessionId' }, { status: 400 });
    }

    // Await both clients (your factories may be async)
    const ssr = (await createSSR()) as SupabaseClient;
    const svc = (await createServiceClient()) as SupabaseClient;

    const owned = await getOwnedSession(ssr, sessionKey);
    if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const { sessionRow, user } = owned;

    if (mode === 'clear' || mode === 'purge' || mode === 'delete') {
      const { error: delErr } = await svc.from('chat_messages').delete().eq('session_id', sessionRow.id);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, sessionId: sessionKey }, { status: 200 });
    }

    // reset → create new session with same tenant prefix
    const tenantPrefix = sessionKey.split(':')[0] || 'public';
    const freshKey = newSessionKey(tenantPrefix);

    const { error: insErr } = await svc.from('chat_sessions').insert({
      user_id: user.id,
      account_id: sessionRow.account_id,
      title: 'New chat',
      session_key: freshKey,
    });

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    return NextResponse.json({ sessionId: freshKey }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
