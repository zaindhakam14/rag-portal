
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient as createSSR } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { chatInput, sessionId } = await req.json();

    // 1) Determine tenant string for webhook routing (unchanged)
    const accountIdForWebhook = sessionId?.split(':')[0] || 'public';

    // 2) Read webhook config with service role (bypass RLS)
    const svc = createServiceClient();
    const { data: webhookConfig, error: cfgErr } = await svc
      .from('account_webhooks')
      .select('webhook_url, webhook_auth')
      .eq('account_id', accountIdForWebhook)
      .single();

    if (cfgErr || !webhookConfig) {
      return new Response(
        JSON.stringify({ error: `No webhook configured for account: ${accountIdForWebhook}` }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      );
    }

    // 3) Call n8n webhook
    const payload = { chatInput: chatInput ?? '', sessionId: sessionId ?? '', accountId: accountIdForWebhook };
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (webhookConfig.webhook_auth) {
      headers.authorization = 'Basic ' + Buffer.from(webhookConfig.webhook_auth, 'utf8').toString('base64');
    }

    const r = await fetch(webhookConfig.webhook_url, { method: 'POST', headers, body: JSON.stringify(payload) });

    // 4) Normalize n8n response to { reply: string }
    let reply = '';
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = await r.json();
      reply = (j?.reply ?? j?.text ?? j?.output ?? '').toString();
    } else {
      reply = (await r.text()) ?? '';
    }

    // 5) Persist transcript (best-effort; never break the chat on failure)
    try {
      // who is the user?
      const ssr = await createSSR();
      const { data: { user } } = await ssr.auth.getUser();
      if (user && sessionId) {
        // find the user's account UUID (use first membership)
        const { data: membership } = await svc
          .from('account_users')
          .select('account_id')
          .eq('user_id', user.id)
          .limit(1);

        const accountUuid = membership?.[0]?.account_id as string | undefined;

        if (accountUuid) {
          // ensure a chat_sessions row exists for this session_key
          const { data: existing } = await svc
            .from('chat_sessions')
            .select('id')
            .eq('account_id', accountUuid)
            .eq('user_id', user.id)
            .eq('session_key', sessionId)
            .limit(1);

          let sessionUuid = existing?.[0]?.id as string | undefined;

          if (!sessionUuid) {
            const { data: created } = await svc
              .from('chat_sessions')
              .insert({
                account_id: accountUuid,
                user_id: user.id,
                session_key: sessionId,
                title: (chatInput || 'New chat').slice(0, 80),
              })
              .select('id')
              .single();
            sessionUuid = created?.id as string | undefined;
          }

          if (sessionUuid) {
            // append both messages
            const rows = [
              {
                session_id: sessionUuid,
                account_id: accountUuid,
                user_id: user.id,
                role: 'user',
                content: chatInput ?? '',
              },
              {
                session_id: sessionUuid,
                account_id: accountUuid,
                user_id: user.id,
                role: 'assistant',
                content: reply ?? '',
              },
            ];
            await svc.from('chat_messages').insert(rows);

            // update session activity
            await svc
              .from('chat_sessions')
              .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('id', sessionUuid);
          }
        }
      }
    } catch (persistErr) {
      // swallow persistence errors; keep chat working
      console.error('persist error', persistErr);
    }

    // 6) return normalized JSON to the client
    return new Response(JSON.stringify({ reply }), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
