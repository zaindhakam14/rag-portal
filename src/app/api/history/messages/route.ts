
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Find the session by session_key
  const { data: session, error: sessErr } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('session_key', sessionId)
    .maybeSingle();

  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });
  if (!session) return NextResponse.json({ messages: [] });

  // Load messages for that session
  const { data: rows, error: msgErr } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true });

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  return NextResponse.json({ messages: rows ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const body = await req.json().catch(() => null);
  const { sessionId, messages } = body || {};

  if (!sessionId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 });
  }

  // Ensure a session row exists (account_id/user_id can be null)
  let { data: session, error: sessErr } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('session_key', sessionId)
    .maybeSingle();

  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });

  if (!session) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ session_key: sessionId, title: 'Session' })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    session = data;
  }

  const rowsToInsert = messages.map((m: any) => ({
    session_id: session!.id,
    role: m.role,
    content: m.content,
    created_at: m.created_at ?? new Date().toISOString(),
  }));

  const { error: insErr } = await supabase.from('chat_messages').insert(rowsToInsert);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
