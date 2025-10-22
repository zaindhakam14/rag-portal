// Ensure Node runtime so Buffer is available
export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { chatInput, sessionId } = await req.json();

    // Build the payload shape your n8n workflow expects
    const payload = {
      chatInput: chatInput,            // <-- important: key is `input`
      sessionId: sessionId ?? '' // keep a stable id per user/browser
    };

    const url = process.env.N8N_WEBHOOK_URL!;
    const basic = process.env.N8N_WEBHOOK_BASIC ?? ''; // "user:pass", optional

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (basic) {
      // Basic Auth header
      headers['authorization'] =
        'Basic ' + Buffer.from(basic, 'utf8').toString('base64');
    }

    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      // Let n8n return whatever JSON it wants
    });

    // Pass through n8n’s response (and status) to the client
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

