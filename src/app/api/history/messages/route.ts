// app/api/history/messages/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSSR } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// Helper: look up a session by its public session_key
async function getSessionByKey(supabase: Awaited<ReturnType<typeof createSSR>>, sessionKey: string) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, account_id, user_id, session_key')
    .eq('session_key', sessionKey)
    .single();

  if (error || !data) return { error: 'Session not found' as const, session: null };
  return { error: null, session: data };
}

/** GET: return history for a session (already working on your side) */
export async function GET(req: NextRequest) {
  const supabase = await createSSR();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  const { error, session } = await getSessionByKey(supabase, sessionId);
  if (error || !session) return NextResponse.json({ error }, { status: 404 });

  // RLS will enforce membership
  const { data: messages, error: mErr } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
  return NextResponse.json({ messages: messages ?? [] });
}

/** POST: append one or more messages to a session (fixes the 405) */
export async function POST(req: NextRequest) {
  const supabase = await createSSR();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload: {
    sessionId?: string;
    messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string; created_at?: string }>;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sessionId, messages } = payload || {};
  if (!sessionId || !messages?.length) {
    return NextResponse.json({ error: 'sessionId and messages are required' }, { status: 400 });
  }

  const { error, session } = await getSessionByKey(supabase, sessionId);
  if (error || !session) return NextResponse.json({ error }, { status: 404 });

  // Shape rows for insert; include account_id to satisfy your WITH CHECK policy
  const rows = messages.map(m => ({
    session_id: session.id,
    account_id: session.account_id,
    user_id: user.id,  
    role: m.role,
    content: m.content,
    created_at: m.created_at ?? new Date().toISOString(),
  }));

  const { error: insErr, count } = await supabase
    .from('chat_messages')
    .insert(rows, { count: 'exact' });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ inserted: count ?? rows.length });
}

/** DELETE: clear history; mode=reset (new session) or mode=purge (keep session) */
export async function DELETE(req: NextRequest) {
  const supabase = await createSSR();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const mode = (searchParams.get('mode') || 'reset') as 'reset' | 'purge';
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  const { error, session } = await getSessionByKey(supabase, sessionId);
  if (error || !session) return NextResponse.json({ error }, { status: 404 });

  // Delete messages in this session
  const { error: delErr } = await supabase
    .from('chat_messages')
    .delete()
    .eq('session_id', session.id);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (mode === 'purge') {
    // keep the same session; client will continue using current sessionId
    return NextResponse.json({ sessionId });
  }

  // mode === 'reset' → create a fresh session key and row
  const svc = createServiceClient(); // service role bypasses RLS for server-side creation
  const newKey = `${sessionId.split(':')[0]}:${Math.random().toString(36).slice(2, 18)}`;

  const { data: newSession, error: createErr } = await svc
    .from('chat_sessions')
    .insert({
      user_id: session.user_id,
      account_id: session.account_id,
      title: 'New conversation',
      session_key: newKey,
    })
    .select('session_key')
    .single();

  if (createErr || !newSession) {
    return NextResponse.json({ error: createErr?.message || 'Failed to create new session' }, { status: 500 });
  }

  return NextResponse.json({ sessionId: newSession.session_key });
}
