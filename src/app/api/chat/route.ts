// Ensure Node runtime so Buffer is available
export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { chatInput, sessionId } = await req.json();

    // Extract accountId from sessionId (format: "accountId:randomId")
    const accountId = sessionId?.split(':')[0] || 'public';

    // Fetch webhook configuration for this account
    const supabase = await createClient();
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

    // Build the payload shape your n8n workflow expects
    const payload = {
      chatInput: chatInput,
      sessionId: sessionId ?? '',
      accountId: accountId
    };

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (webhookConfig.webhook_auth) {
      // Basic Auth header
      headers['authorization'] =
        'Basic ' + Buffer.from(webhookConfig.webhook_auth, 'utf8').toString('base64');
    }

    const r = await fetch(webhookConfig.webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    // Pass through n8n's response (and status) to the client
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Unknown error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}






