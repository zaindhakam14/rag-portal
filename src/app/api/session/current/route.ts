
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { createClient as createSSR } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  try {
    const ssr = await createSSR();
    const { data: { user } } = await ssr.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    // Optional account slug from query (?account=demo-account), default for now:
    const { searchParams } = new URL(req.url);
    const accountSlug = searchParams.get('account') || 'demo-account';

    const svc = createServiceClient();

    // Find the user's account (first membership)
    const { data: membership, error: mErr } = await svc
      .from('account_users')
      .select('account_id')
      .eq('user_id', user.id)
      .limit(1);
    if (mErr || !membership || !membership.length) {
      return new Response(JSON.stringify({ error: 'No account membership found for user' }), { status: 403, headers: { 'content-type': 'application/json' } });
    }
    const accountUuid = membership[0].account_id as string;

    // Try to re-use the most recent session for this user+account
    const { data: existing, error: sErr } = await svc
      .from('chat_sessions')
      .select('id, session_key')
      .eq('account_id', accountUuid)
      .eq('user_id', user.id)
      .order('last_activity_at', { ascending: false })
      .limit(1);
    if (!sErr && existing && existing.length) {
      return new Response(JSON.stringify({ sessionId: existing[0].session_key }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    // Otherwise create a canonical session
    const newKey = `${accountSlug}:${crypto.randomUUID().replace(/-/g, '')}`;
    const { data: created, error: cErr } = await svc
      .from('chat_sessions')
      .insert({
        account_id: accountUuid,
        user_id: user.id,
        session_key: newKey,
        title: 'New chat',
      })
      .select('session_key')
      .single();

    if (cErr || !created) {
      return new Response(JSON.stringify({ error: 'Failed to create session' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }

    return new Response(JSON.stringify({ sessionId: created.session_key }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
