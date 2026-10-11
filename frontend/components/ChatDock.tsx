'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { usePathname } from 'next/navigation';

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  fallback?: boolean;
};

const SESSION_KEY = 'rv_chat_session';
const HISTORY_KEY = 'rv_chat_history';

export default function ChatDock() {
  const { lang, setLang } = useI18n();
  const path = usePathname();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [unread, setUnread] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Do not show the assistant on the admin console (staff tool, not a chatbot).
  const hidden = path?.startsWith('/admin');

  // ---- Load session & history ----
  useEffect(() => {
    try {
      const s = window.localStorage.getItem(SESSION_KEY);
      if (s) setSessionKey(s);
      const h = window.localStorage.getItem(HISTORY_KEY);
      if (h) setMessages(JSON.parse(h).slice(-30));
    } catch { /* ignore */ }
    api.aiStatus().then((r) => setAiConfigured(r.configured)).catch(() => setAiConfigured(false));
  }, []);

  // ---- Persist history ----
  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-30)));
    } catch { /* ignore */ }
  }, [messages]);

  // ---- Auto-scroll to bottom on new messages / when opening ----
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, [messages, busy, open]);

  // ---- Focus input when opened ----
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // ---- Clear unread when opened ----
  useEffect(() => { if (open) setUnread(0); }, [open]);

  // ---- Escape closes the dock ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send(text?: string) {
    const content = (text ?? msg).trim();
    if (!content || busy) return;
    setMsg('');
    setErr(null);

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      ts: Date.now()
    };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);

    try {
      const r = await api.aiChat({
        sessionKey: sessionKey || undefined,
        message: content,
        lang,
        history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content }))
      });

      if (r.sessionKey && r.sessionKey !== sessionKey) {
        setSessionKey(r.sessionKey);
        try { window.localStorage.setItem(SESSION_KEY, r.sessionKey); } catch {}
      }

      const assistantMsg: Msg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: r.reply,
        ts: Date.now(),
        fallback: !!r.fallback
      };
      setMessages((m) => [...m, assistantMsg]);
      if (!open) setUnread((n) => n + 1);
    } catch (e: any) {
      setErr(e?.message || 'error');
      setMessages((m) => [...m, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: t(
          'Ntabashije kubona igisubizo. Ongera ugerageze.',
          "I couldn't get a response. Please try again."
        ),
        ts: Date.now(),
        fallback: true
      }]);
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setSessionKey(null);
    setErr(null);
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(HISTORY_KEY);
    } catch { /* ignore */ }
  }

  const suggestions = lang === 'rw'
    ? [
        'Igihe bisi izagera',
        'Inzira nziza i Nyabugogo',
        'Igiciro kuva Remera',
        'Aho nshobora kurya hafi'
      ]
    : [
        'When is the next bus?',
        'Best route to Nyabugogo',
        'Fare from Remera',
        'Where can I eat nearby'
      ];

  if (hidden) return null;

  return (
    <>
      {/* ---------- Floating launcher ---------- */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('Fungura umufasha', 'Open assistant')}
        className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-600 to-emerald-600 px-5 py-3.5 text-sm font-semibold text-white shadow-2xl shadow-sky-900/30 transition hover:from-sky-500 hover:to-emerald-500 ${
          open ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <Sparkle />
        <span className="hidden sm:inline">{t('Baza RouteView', 'Ask RouteView')}</span>
        {unread > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-sky-700">
            {unread}
          </span>
        )}
      </button>

      {/* ---------- Panel ---------- */}
      <div
        className={`fixed bottom-5 right-5 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 dark:border-slate-800 dark:bg-slate-900 ${
          open
            ? 'h-[min(640px,calc(100vh-2rem))] translate-y-0 opacity-100'
            : 'pointer-events-none h-0 translate-y-4 opacity-0'
        }`}
      >
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 px-4 py-3 text-white dark:border-slate-800">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 shadow-md">
            <Sparkle />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">RouteView Assistant</p>
            <p className="flex items-center gap-1.5 text-[10px] text-slate-300">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                aiConfigured === false ? 'bg-amber-400'
                : aiConfigured === true ? 'bg-emerald-400'
                : 'bg-slate-400'
              }`} />
              {aiConfigured === false
                ? t('Ntaboneka', 'Offline')
                : aiConfigured === true
                ? t('Irakora', 'Online')
                : t('Turashakisha…', 'Connecting…')}
            </p>
          </div>

          {/* Language toggle */}
          <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-0.5 text-[10px] font-semibold">
            <button
              onClick={() => setLang('rw')}
              className={`rounded-full px-2 py-1 transition ${lang === 'rw' ? 'bg-white text-slate-900' : 'text-slate-300'}`}
            >
              RW
            </button>
            <button
              onClick={() => setLang('en')}
              className={`rounded-full px-2 py-1 transition ${lang === 'en' ? 'bg-white text-slate-900' : 'text-slate-300'}`}
            >
              EN
            </button>
          </div>

          <button
            onClick={clearChat}
            title={t('Siba ibiganiro', 'Clear chat')}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <Trash />
          </button>
          <button
            onClick={() => setOpen(false)}
            title={t('Funga', 'Close')}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <Close />
          </button>
        </header>

        {/* Offline notice */}
        {aiConfigured === false && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {t(
              'Umufasha wa AI ntarashyirwaho. Ushobora gukomeza gukoresha RouteView.',
              "The assistant isn't configured yet. RouteView still works everywhere else."
            )}
          </div>
        )}

        {/* Messages */}
        <div
          ref={listRef}
          className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4 dark:bg-slate-950/40"
        >
          {messages.length === 0 && (
            <EmptyState lang={lang} />
          )}

          {messages.map((m) => (
            <Bubble key={m.id} msg={m} lang={lang} />
          ))}

          {busy && <TypingIndicator />}

          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {err}
            </div>
          )}
        </div>

        {/* Suggestions (only when no messages) */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={busy}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 transition hover:border-sky-400 hover:text-sky-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-sky-500 dark:hover:text-sky-400"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-end gap-2">
            <input
              ref={inputRef}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={t('Andika ikibazo cyawe…', 'Ask a question…')}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <button
              onClick={() => send()}
              disabled={!msg.trim() || busy}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 text-white shadow-md shadow-sky-600/20 transition hover:from-sky-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t('Ohereza', 'Send')}
            >
              <Send />
            </button>
          </div>
          <p className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span>{t('Bifashijwe na AI · OpenRouter', 'Powered by AI · OpenRouter')}</span>
            <Link href="/plan" onClick={() => setOpen(false)} className="hover:text-sky-600">
              {t('Tegura urugendo →', 'Plan a journey →')}
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

/* ================================================================== */
/*  Pieces                                                             */
/* ================================================================== */

function EmptyState({ lang }: { lang: 'rw' | 'en' }) {
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">
        {t('Murakaza neza 👋', 'Welcome 👋')}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
        {t(
          'Baza ku ngendo, ahantu, ibiciro cyangwa ibihe. Nsubiza nkoresheje amakuru y’urubuga.',
          'Ask about routes, stops, fares or times. I answer using RouteView data.'
        )}
      </p>
    </div>
  );
}

function Bubble({ msg, lang }: { msg: Msg; lang: 'rw' | 'en' }) {
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const isUser = msg.role === 'user';
  const time = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <span className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-sm">
          <Sparkle />
        </span>
      )}
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
        isUser
          ? 'rounded-br-md bg-slate-900 text-white dark:bg-white dark:text-slate-900'
          : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
      }`}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
        <div className={`mt-1 flex items-center gap-1.5 text-[9px] ${
          isUser ? 'text-slate-400 dark:text-slate-500' : 'text-slate-400'
        }`}>
          <span>{time}</span>
          {msg.fallback && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              {t('ntaboneka', 'fallback')}
            </span>
          )}
        </div>
      </div>
      {isUser && (
        <span className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {(typeof window !== 'undefined' && JSON.parse(window.localStorage.getItem('rv_user') || '{}')?.full_name || 'U').slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <span className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-sm">
        <Sparkle />
      </span>
      <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
        </span>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Icons                                                              */
/* ================================================================== */

function Sparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
    </svg>
  );
}
function Send() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
function Close() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function Trash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}