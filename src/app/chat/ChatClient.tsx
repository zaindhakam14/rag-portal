'use client';

import { useEffect, useRef, useState } from 'react';

// Simple uuid (ok for client-only ids)
const uuid = () =>
  Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);

type Msg = { role: 'user' | 'assistant'; content: string; timestamp: Date };

export default function ChatClient({ accountId = 'demo-account' }: { accountId?: string }) {
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isSendingRef = useRef(false); // re-entry guard

  // Ensure light widgets even if OS is dark (also improves placeholder contrast)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }, []);

  // Resolve canonical session for this user+account from server
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/session/current?account=${encodeURIComponent(accountId)}`, {
          cache: 'no-store',
        });
        const j = await res.json();
        if (!cancelled) {
          if (j?.sessionId) setSessionId(j.sessionId);
          else setErr(j?.error || 'Failed to get session');
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to get session');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  // Load history when session is known
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/history/messages?sessionId=${encodeURIComponent(sessionId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;

        const json = await res.json();
        const rows: Array<{ role: 'user' | 'assistant'; content: string; created_at: string }> =
          json?.messages ?? [];

        if (!cancelled && Array.isArray(rows)) {
          const uniq = new Set<string>();
          const hydrated: Msg[] = [];
          for (const r of rows) {
            const key = `${r.role}|${r.content}|${r.created_at}`;
            if (uniq.has(key)) continue;
            uniq.add(key);
            hydrated.push({
              role: r.role,
              content: r.content,
              timestamp: new Date(r.created_at),
            });
          }
          setMsgs(hydrated);
        }
      } catch {
        // ignore; keep UI usable offline
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Keep view pinned to latest
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, loading]);

  async function logout() {
    try {
      // Your existing server route returns 204 No Content, which is perfect.
      await fetch('/logout', { method: 'POST' });
    } catch {
      // ignore; we'll still navigate away
    } finally {
      window.location.href = '/login';
    }
  }

  async function clearChat(mode: 'reset' | 'truncate' = 'reset') {
    if (!sessionId) return;

    const yes = window.confirm(
      mode === 'reset'
        ? 'Clear this conversation and start a fresh session?'
        : 'Delete all messages but keep this session?'
    );
    if (!yes) return;

    setLoading(true);
    setErr(null);
    try {
      const url = `/api/history/messages?${new URLSearchParams({
        sessionId,
        mode,
      }).toString()}`;

      const res = await fetch(url, { method: 'DELETE' });

      // Avoid "Unexpected end of JSON"
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const nextId = data?.sessionId || sessionId;
      setMsgs([]);
      setSessionId(nextId);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e: any) {
      setErr(e?.message || 'Failed to clear chat');
    } finally {
      setLoading(false);
    }
  }

  // Single path to submit: the form submit handler
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (isSendingRef.current) return;      // guard
    if (!input.trim() || loading) return;

    isSendingRef.current = true;

    const userMsg: Msg = { role: 'user', content: input.trim(), timestamp: new Date() };
    setMsgs((m) => [...m, userMsg]);
    setInput('');
    setErr(null);
    setLoading(true);

    try {
      // Ask agent
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatInput: userMsg.content, sessionId }),
      });
      const data = await res.json();
      const reply = (data?.reply ?? data?.text ?? '').toString();

      const assistantMsg: Msg = { role: 'assistant', content: reply, timestamp: new Date() };
      setMsgs((m) => [...m, assistantMsg]);

      // Best-effort persist both turns
      try {
        await fetch('/api/history/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            // include client ids if you later add a unique constraint
            messages: [
              {
                role: userMsg.role,
                content: userMsg.content,
                created_at: userMsg.timestamp.toISOString(),
                client_msg_id: uuid(),
              },
              {
                role: assistantMsg.role,
                content: assistantMsg.content,
                created_at: assistantMsg.timestamp.toISOString(),
                client_msg_id: uuid(),
              },
            ],
          }),
        });
      } catch {
        // swallow persistence errors to keep UX snappy
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to send message');
    } finally {
      setLoading(false);
      isSendingRef.current = false;
    }
  }

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* --- Background pattern --- */}
      <div className="pointer-events-none fixed inset-0 -z-20">
        <svg className="w-full h-full text-slate-400 opacity-[0.32]" aria-hidden="true">
          <defs>
            <pattern id="cubePattern" width="220" height="220" patternUnits="userSpaceOnUse">
              <g
                transform="translate(40,48)"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeOpacity=".55"
                fill="none"
              >
                <rect x="16" y="-16" width="120" height="120" />
                <rect x="0" y="0" width="120" height="120" />
                <line x1="0" y1="0" x2="16" y2="-16" />
                <line x1="120" y1="0" x2="136" y2="-16" />
                <line x1="0" y1="120" x2="16" y2="104" />
                <line x1="120" y1="120" x2="136" y2="104" />
                {[
                  [0, 0],
                  [120, 0],
                  [0, 120],
                  [120, 120],
                  [16, -16],
                  [136, -16],
                  [16, 104],
                  [136, 104],
                ].map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r="2.4" fill="currentColor" opacity=".55" />
                ))}
              </g>
            </pattern>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="url(#cubePattern)"
            style={{
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent, black 6%, black 94%, transparent)',
              maskImage:
                'linear-gradient(to bottom, transparent, black 6%, black 94%, transparent)',
            }}
          />
        </svg>
      </div>

      {/* --- Color blobs --- */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[15%] left-[20%] w-20 h-20 rounded-full bg-blue-400 mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
        <div className="absolute top-[25%] right-[15%] w-16 h-16 rounded-full bg-purple-400 mix-blend-multiply filter blur-3xl opacity-45 animate-blob animation-delay-2000" />
        <div className="absolute top-[60%] left-[10%] w-24 h-24 rounded-full bg-pink-400 mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000" />
        <div className="absolute top-[45%] right-[25%] w-20 h-20 rounded-full bg-indigo-400 mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-6000" />
        <div className="absolute bottom-[20%] left-[45%] w-16 h-16 rounded-full bg-cyan-400 mix-blend-multiply filter blur-3xl opacity-45 animate-blob animation-delay-8000" />
        <div className="absolute top-[35%] left-[60%] w-20 h-20 rounded-full bg-rose-400 mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-3000" />
        <div className="absolute bottom-[35%] right-[35%] w-24 h-24 rounded-full bg-violet-400 mix-blend-multiply filter blur-3xl opacity-45 animate-blob animation-delay-5000" />
        <div className="absolute top-[70%] right-[20%] w-16 h-16 rounded-full bg-teal-400 mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-7000" />
      </div>

  {/* Header */}
  <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 shadow-sm relative z-10">
    <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Knowledge Assistant</h1>
          <p className="text-sm text-slate-500">Ask me anything about your business</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href="https://drive.google.com/drive/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white/80 hover:bg-white shadow-sm text-sm text-slate-700 transition"
          title="Open Google Drive (opens in new tab)"
        >
          <span className="inline-flex items-center gap-2">
            {/* tiny drive icon */}
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
              <path fill="#34A853" d="M12.9 3l4.6 8H9.8L5.2 3h7.7z"/>
              <path fill="#FBBC05" d="M21 17l-3.5-6H9.8L6.3 17H21z"/>
              <path fill="#4285F4" d="M2.9 17l6.9 4 3.4-6H6.3L2.9 17z"/>
            </svg>
            Drive
          </span>
        </a>

        <button
          type="button"
          onClick={logout}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white/80 hover:bg-white shadow-sm text-sm text-slate-700 transition"
          title="Sign out"
        >
          Logout
        </button>

        <button
          type="button"
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


      {/* Messages (scrolls) */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 overflow-y-auto relative z-10">
        {msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Start a conversation</h2>
            <p className="text-slate-500 max-w-md mb-6">
              Ask questions about your business data, documents, and more. I'm here to help!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
              {[
                'What were our sales last quarter?',
                'Summarize recent customer feedback',
                'Show me team performance metrics',
                'What are the upcoming deadlines?',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion)}
                  className="px-4 py-3 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/80 transition-all text-left text-sm text-slate-700 shadow-sm hover:shadow"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {msgs.map((m, i) => (
              <div
                key={`${m.role}-${m.timestamp.getTime()}-${i}`}
                className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                      : 'bg-gradient-to-br from-slate-200 to-slate-300'
                  }`}
                >
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

                <div className={`flex flex-col gap-1 max-w-3xl ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-5 py-4 rounded-2xl ${
                      m.role === 'user'
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md'
                        : 'bg-white/80 backdrop-blur-sm text-slate-900 shadow-sm border border-slate-200'
                    }`}
                  >
                    <p className="text-base leading-loose whitespace-pre-wrap font-sans tracking-normal">
                      {m.content}
                    </p>
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
                <div className="bg-white/80 backdrop-blur-sm px-5 py-4 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Sticky Input Area */}
      <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t border-slate-200 shadow-lg z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          {err && (
            <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {err}
            </div>
          )}

          <form ref={formRef} onSubmit={send} className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-sm bg-white text-slate-900 placeholder-slate-400 dark:text-slate-900 dark:placeholder-slate-500 caret-blue-600"
                placeholder="Ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); // avoid newline
                    if (formRef.current?.requestSubmit) {
                      formRef.current.requestSubmit();
                    } else {
                      // fallback
                      formRef.current?.dispatchEvent(
                        new Event('submit', { cancelable: true, bubbles: true })
                      );
                    }
                  }
                }}
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px', color: '#0f172a' }}
              />
              <div className="absolute right-3 bottom-3 text-xs text-slate-400">Enter to send</div>
            </div>

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
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

      {/* Local animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        :global(@keyframes blob) {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(30px, -50px) scale(1.1); }
          66%      { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-blob    { animation: blob 20s ease-in-out infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-3000 { animation-delay: 3s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animation-delay-5000 { animation-delay: 5s; }
        .animation-delay-6000 { animation-delay: 6s; }
        .animation-delay-7000 { animation-delay: 7s; }
        .animation-delay-8000 { animation-delay: 8s; }
      `}</style>
    </div>
  );
}
