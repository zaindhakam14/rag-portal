
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    const { chatInput, sessionId } = await req.json();

    // sessionId format is "accountId:random"
    const accountId = sessionId?.split(':')[0] || 'public';

    // Use service role so RLS doesn't block reading account_webhooks
    const supabase = createServiceClient();
    const { data: webhookConfig, error } = await supabase
      .from('account_webhooks')
      .select('webhook_url, webhook_auth')
      .eq('account_id', accountId)
      .single();

    if (error || !webhookConfig) {
      return new Response(
        JSON.stringify({ error: `No webhook configured for account: ${accountId}` }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      );
    }

    const payload = {
      chatInput: chatInput ?? '',
      sessionId: sessionId ?? '',
      accountId,
    };

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (webhookConfig.webhook_auth) {
      headers.authorization =
        'Basic ' + Buffer.from(webhookConfig.webhook_auth, 'utf8').toString('base64');
    }

    const r = await fetch(webhookConfig.webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      // pass JSON straight through
      const json = await r.text();
      return new Response(json, {
        status: r.status,
        headers: { 'content-type': 'application/json' },
      });
    } else {
      // coerce text/other to JSON with a 'reply' field
      const text = await r.text();
      return new Response(JSON.stringify({ reply: text }), {
        status: r.status,
        headers: { 'content-type': 'application/json' },
      });
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Unknown error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
