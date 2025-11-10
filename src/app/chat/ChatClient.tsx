'use client';

import * as React from 'react';

type Role = 'user' | 'assistant';
type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  timestamp: string; // ISO
};

const DEFAULT_ACCOUNT_KEY = 'demo-account';

function genId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2, 10);
}

function genSessionKey(prefix: string) {
  const rnd = Math.random().toString(36).slice(2, 12);
  return `${prefix}:${rnd}`;
}

export default function Client() {
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const scrollAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Restore/create session key
  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('chat:sessionId') : null;
    if (stored) {
      setSessionId(stored);
    } else {
      const fresh = genSessionKey(DEFAULT_ACCOUNT_KEY);
      setSessionId(fresh);
      if (typeof window !== 'undefined') localStorage.setItem('chat:sessionId', fresh);
    }
  }, []);

  // Load history
  React.useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    (async () => {
      try {
        setError(null);
        const res = await fetch(`/api/history/messages?${new URLSearchParams({ sessionId })}`);
        if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
        const data = await res.json();
        const loaded: ChatMessage[] = (data?.messages ?? []).map((m: any) => ({
          id: genId(),
          role: m.role as Role,
          content: m.content,
          timestamp: m.created_at ?? new Date().toISOString(),
        }));
        if (!cancelled) setMessages(loaded);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load messages');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Scroll to bottom on new messages
  React.useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // Auto-grow textarea
  React.useEffect(() => {
    const el = textAreaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = Math.min(el.scrollHeight, 320) + 'px';
  }, [chatInput]);

  async function persistPair(u: ChatMessage, a: ChatMessage) {
    try {
      await fetch('/api/history/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messages: [
            { role: u.role, content: u.content, created_at: u.timestamp },
            { role: a.role, content: a.content, created_at: a.timestamp },
          ],
        }),
      });
    } catch {
      console.warn('Failed to persist messages'); // non-fatal
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !sessionId || loading) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((m) => [...m, userMsg]);
    setChatInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatInput: userMsg.content, sessionId }),
      });
      if (!res.ok) throw new Error(`Chat error (${res.status})`);
      const data = await res.json();
      const answerText = data?.answer ?? data?.message ?? data?.content ?? '…';

      const assistantMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: answerText,
        timestamp: new Date().toISOString(),
      };

      setMessages((m) => [...m, assistantMsg]);
      await persistPair(userMsg, assistantMsg);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send message');
    } finally {
      setLoading(false);
    }
  }

  async function clearChat(mode: 'reset' | 'purge' = 'reset') {
    if (!sessionId) return;
    const ok = window.confirm(
      mode === 'reset'
        ? 'Clear this conversation and start a fresh session?'
        : 'Delete ALL messages in this session?'
    );
    if (!ok) return;

    setLoading(true);
    setError(null);

    try {
      const url = `/api/history/messages?${new URLSearchParams({ sessionId, mode })}`;
      const res = await fetch(url, { method: 'DELETE' });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      const next = (json?.sessionId as string) || sessionId;
      setMessages([]);
      setSessionId(next);
      if (typeof window !== 'undefined') localStorage.setItem('chat:sessionId', next);
      scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to clear chat');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100svh] flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 shadow-sm relative z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Knowledge Assistant</h1>
              <p className="text-sm text-slate-500">Ask me anything about your business</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => clearChat('reset')}
              disabled={loading || !sessionId}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white/80 hover:bg-white shadow-sm text-sm text-slate-700 transition disabled:opacity-50"
              title="Clear this conversation and start a new one"
            >
              Clear chat
            </button>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-slate-600">Online</span>
          </div>
        </div>
      </div>

      {/* Messages list (scrolls) */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-[calc(112px+env(safe-area-inset-bottom))]">
          {messages.length === 0 && (
            <div className="text-slate-500 text-sm mb-4">Start a conversation…</div>
          )}

          <div className="space-y-4">
            {messages.map((m) => (
              <div key={m.id} className="flex">
                <div
                  className={
                    m.role === 'user'
                      ? 'ml-auto max-w-[85%] rounded-2xl bg-indigo-600 text-white px-4 py-3 shadow'
                      : 'mr-auto max-w-[85%] rounded-2xl bg-white border border-slate-200 text-slate-900 px-4 py-3 shadow-sm'
                  }
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                </div>
              </div>
            ))}
          </div>

          <div ref={scrollAnchorRef} className="h-1" />
        </div>
      </main>

      {/* Fixed footer composer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          {error && (
            <div className="mb-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-end gap-2">
            <textarea
              ref={textAreaRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask a question…"
              rows={1}
              autoComplete="off"
              className="w-full resize-none max-h-40 rounded-xl border border-slate-300 bg-white px-3 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !chatInput.trim()}
              className="shrink-0 rounded-xl bg-indigo-600 px-4 py-3 text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>

          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </div>
    </div>
  );
}
