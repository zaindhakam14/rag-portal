
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string; timestamp: Date };

export default function ChatClient({ accountId = 'demo-account' }: { accountId?: string }) {
  const [sessionId, setSessionId] = useState<string>('');
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const storageKey = useMemo(() => `rag-chat-cache:${accountId}`, [accountId]);

  // Resolve canonical session
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/session/current?account=${encodeURIComponent(accountId)}`, { cache: 'no-store' });
        const j = await r.json();
        if (j?.sessionId) setSessionId(j.sessionId);
        else setErr(j?.error || 'Failed to get session');
      } catch (e: any) {
        setErr(e?.message || 'Failed to get session');
      }
    })();
  }, [accountId]);

  // Load history
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const r = await fetch(`/api/history?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
        const j = await r.json();
        const history: Msg[] = (j?.messages ?? []).map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
        }));
        setMsgs(history);
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify(history.map(m => ({ ...m, timestamp: m.timestamp.toISOString() }))),
          );
        } catch {}
      } catch {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw) as Array<Omit<Msg, 'timestamp'> & { timestamp: string }>;
            setMsgs(parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
          }
        } catch {}
      }
    })();
  }, [sessionId, storageKey]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading || !sessionId) return;

    const userMsg: Msg = { role: 'user', content: input.trim(), timestamp: new Date() };
    setMsgs(m => [...m, userMsg]);
    setInput('');
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatInput: userMsg.content, sessionId }),
      });
      let reply = '';
      try {
        const data = await res.json();
        reply = (data?.reply ?? data?.text ?? '').toString();
      } catch {}
      setMsgs(m => [...m, { role: 'assistant', content: reply, timestamp: new Date() }]);

      try {
        const serializable = [...msgs, userMsg, { role: 'assistant', content: reply, timestamp: new Date() }].map(m => ({
          ...m, timestamp: m.timestamp.toISOString(),
        }));
        localStorage.setItem(storageKey, JSON.stringify(serializable));
      } catch {}
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to send message');
    } finally {
      setLoading(false);
    }
  }

  async function clearChat() {
    if (!sessionId) return;
    const yes = window.confirm('Clear this conversation for all your devices? This cannot be undone.');
    if (!yes) return;

    setLoading(true);
    try {
      const r = await fetch(`/api/history?sessionId=${encodeURIComponent(sessionId)}&mode=reset`, {
        method: 'DELETE',
      });
      const j = await r.json();
      const nextId = j?.sessionId || sessionId;

      setMsgs([]);
      setSessionId(nextId);
      try { localStorage.removeItem(storageKey); } catch {}
    } catch (e: any) {
      setErr(e?.message || 'Failed to clear chat');
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col relative">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Knowledge Assistant</h1>
              <p className="text-sm text-slate-500">
                Session <span className="font-mono">{sessionId ? sessionId.slice(0, 18) + '…' : 'resolving…'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={clearChat}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white/80 hover:bg-white shadow-sm text-sm text-slate-700 transition"
              title="Clear this conversation for all devices"
              disabled={!sessionId || loading}
            >
              Clear chat
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-slate-600">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 overflow-y-auto">
        {msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Start a conversation</h2>
            <p className="text-slate-500 max-w-md mb-6">Ask questions about your business data, documents, and more.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
              {['What products do we offer?', 'Show me our latest sales data', 'Who are our key clients?', 'What are our company values?'].map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s)}
                  className="px-4 py-3 bg-white/80 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left text-sm text-slate-700 shadow-sm hover:shadow"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  m.role === 'user' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-slate-200 to-slate-300'
                }`}>
                  {m.role === 'user' ? (
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707" />
                    </svg>
                  )}
                </div>
                <div className={`flex flex-col gap-1 max-w-2xl ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-3 rounded-2xl ${m.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md'
                      : 'bg-white/90 text-slate-900 shadow-sm border border-slate-200'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  </div>
                  <span className="text-xs text-slate-400 px-2">{formatTime(m.timestamp)}</span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 animate-fade-in">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707" />
                  </svg>
                </div>
                <div className="bg-white/90 px-4 py-3 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full animate-bounce bg-slate-400" />
                    <div className="w-2 h-2 rounded-full animate-bounce bg-slate-400" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce bg-slate-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white/90 backdrop-blur border-t border-slate-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-4">
          {err && (
            <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {err}
            </div>
          )}

          <form onSubmit={send} className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-sm bg-white/90 text-black"
                placeholder="Ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }}
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
              <div className="absolute right-3 bottom-3 text-xs text-slate-400">Press Enter to send</div>
            </div>

            <button
              type="submit"
              disabled={loading || !input.trim() || !sessionId}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending
                </>
              ) : (
                <>
                  <span>Send</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
