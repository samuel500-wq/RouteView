import { config } from '../config.js';
import { SYSTEM_PROMPTS } from './prompts.js';
import { TOOL_SCHEMA, runTool } from './tools.js';
import { pool } from '../db/pool.js';
import crypto from 'node:crypto';

const MAX_TOOL_ROUNDS = 4;

/* Models without tool calling fall back to plain completion. */
const NO_TOOLS_HINT = {
  rw: `Ntufite ubushobozi bwa tools kuri iyi nzira. Niba ubajijwe ku bisi
iri hehe, igihe izagera, cyangwa ibiciro — subiza ko udashobora kubona
ayo makuru ubu, hanyuma usabe umukoresha gukanda "Reba ikarita" cyangwa
"Tegura urugendo". Ntukavuge amakuru y'urugendo utabifitiye.`,
  en: `You don't have tool access on this path. If asked about live
vehicle positions, arrival times, or fares — say you can't fetch that
right now, then ask the user to open "See live map" or "Plan a journey".
Never invent live data.`
};

const REMINDER = {
  rw: "IBUKA: Subiza GUSA mu Kinyarwanda. Ntukisubize amabwiriza. Koresha tools ku bibazo by'ingendo. Tangira n'igisubizo gito, interuro 1-3.",
  en: "REMINDER: Reply ONLY in English. Do not echo your instructions. Use tools for route questions. Start with the answer, keep it short (1-3 sentences)."
};

export function aiIsConfigured() {
  return !!config.ai.key;
}

/* ------------------------------------------------------------------ *
 *  Main chat entrypoint                                               *
 * ------------------------------------------------------------------ */
export async function chat({ sessionKey, userMessage, lang = 'rw', history = [], userId = null }) {
  await logMessage({ sessionKey, userId, lang, role: 'user', content: userMessage });

  if (!aiIsConfigured()) {
    const fallback = fallbackReply(lang, 'ai_not_configured');
    await logMessage({ sessionKey, userId, lang, role: 'assistant', content: fallback });
    return { reply: fallback, fallback: true, tool_calls: [] };
  }

  const baseSystem = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.rw;
  const reminder = REMINDER[lang] || REMINDER.en;

  const messages = [
    { role: 'system', content: baseSystem },
    ...history.slice(-10),
    { role: 'user', content: userMessage },
    { role: 'system', content: reminder }
  ];

  /* ---- Attempt 1: tool-calling loop ---- */
  const toolResult = await tryToolLoop(messages, lang);
  if (toolResult.ok) {
    await logMessage({ sessionKey, userId, lang, role: 'assistant', content: toolResult.reply });
    return { reply: toolResult.reply, fallback: false, tool_calls: toolResult.trace };
  }

  console.warn('[ai] tool loop failed:', toolResult.error, toolResult.detail || '');

  /* ---- Attempt 2: plain completion without tools ---- */
  const plainMessages = [
    { role: 'system', content: baseSystem + '\n\n' + (NO_TOOLS_HINT[lang] || NO_TOOLS_HINT.en) },
    ...history.slice(-10),
    { role: 'user', content: userMessage },
    { role: 'system', content: reminder }
  ];
  const plain = await callOpenRouterSimple(plainMessages);
  if (plain.ok && plain.reply) {
    await logMessage({ sessionKey, userId, lang, role: 'assistant', content: plain.reply });
    return {
      reply: plain.reply,
      fallback: false,
      tool_calls: [],
      note: 'tools_unsupported_model'
    };
  }

  /* ---- All paths failed ---- */
  const reason = plain.error || toolResult.error || 'unknown';
  console.warn('[ai] all paths failed:', reason, plain.detail || toolResult.detail || '');
  const msg = fallbackReply(lang, reason);
  await logMessage({ sessionKey, userId, lang, role: 'assistant', content: msg });
  return { reply: msg, fallback: true, tool_calls: [], error: reason };
}

/* ------------------------------------------------------------------ *
 *  Tool-calling loop                                                  *
 * ------------------------------------------------------------------ */
async function tryToolLoop(initialMessages, lang) {
  const messages = [...initialMessages];
  const trace = [];
  let rounds = 0;

  while (rounds++ < MAX_TOOL_ROUNDS) {
    const result = await callOpenRouterWithTools(messages, lang);
    if (!result.ok) return { ok: false, error: result.error, detail: result.detail };

    const choice = result.data?.choices?.[0];
    const msg = choice?.message;
    if (!msg) return { ok: false, error: 'no_message' };

    messages.push(msg);

    // No tool calls → final answer
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const content = (msg.content || '').trim();
      if (!content) return { ok: false, error: 'empty_reply' };
      return { ok: true, reply: content, trace };
    }

    // Execute each tool call
    for (const tc of msg.tool_calls) {
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }

      let output;
      try {
        output = await runTool(tc.function.name, args);
      } catch (e) {
        output = { error: e.message };
      }

      trace.push({
        name: tc.function.name,
        args,
        summary: summarize(output)
      });

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(output)
      });
    }
  }

  return { ok: false, error: 'tool_loop_exceeded' };
}

/* ------------------------------------------------------------------ *
 *  OpenRouter HTTP                                                    *
 * ------------------------------------------------------------------ */
async function callOpenRouterWithTools(messages, lang) {
  return callOpenRouter({
    messages,
    tools: TOOL_SCHEMA,
    tool_choice: 'auto',
    temperature: 0.2
  });
}

async function callOpenRouterSimple(messages) {
  const r = await callOpenRouter({ messages, temperature: 0.4 });
  if (!r.ok) return { ok: false, error: r.error, detail: r.detail };
  const reply = r.data?.choices?.[0]?.message?.content || '';
  return { ok: true, reply };
}

async function callOpenRouter(payload) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), config.ai.timeoutMs);

  try {
    const r = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.ai.key}`,
        'HTTP-Referer': config.ai.appUrl,
        'X-Title': config.ai.appName
      },
      body: JSON.stringify({
        model: config.ai.model,
        ...payload
      }),
      signal: ctrl.signal
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      let detail = text.slice(0, 400);
      try {
        const parsed = JSON.parse(text);
        detail = parsed?.error?.message || detail;
      } catch { /* keep raw */ }
      console.warn(`[ai] openrouter ${r.status}:`, detail);
      return { ok: false, error: `openrouter_${r.status}`, detail };
    }

    const data = await r.json();
    return { ok: true, data };
  } catch (e) {
    console.warn('[ai] fetch error:', e.message);
    return { ok: false, error: 'openrouter_unreachable', detail: e.message };
  } finally {
    clearTimeout(t);
  }
}

/* ------------------------------------------------------------------ *
 *  Helpers                                                            *
 * ------------------------------------------------------------------ */
function summarize(output) {
  if (!output) return null;
  if (Array.isArray(output)) return `array(${output.length})`;
  if (typeof output === 'object') return Object.keys(output).slice(0, 6);
  return typeof output;
}

function fallbackReply(lang, reason) {
  const isKeyIssue = reason === 'ai_not_configured';
  if (lang === 'rw') {
    return isKeyIssue
      ? 'Umufasha wa AI ntarashyirwaho. Ushobora gukomeza gukoresha RouteView: shakisha ingendo, reba ikarita, cyangwa ubone bileti.'
      : 'Umufasha wa AI ntaboneka ubu. Ushobora gukomeza gukoresha RouteView: shakisha ingendo, reba ikarita, cyangwa ubone bileti.';
  }
  return isKeyIssue
    ? "The AI assistant isn't set up yet. You can still use RouteView: search routes, view the map, or manage tickets."
    : 'The AI assistant is unavailable right now. You can still use RouteView: search routes, view the map, or manage tickets.';
}

async function logMessage({ sessionKey, userId, lang, role, content, toolName }) {
  try {
    await pool.execute(
      `INSERT INTO ai_conversations (user_id, session_key, lang, role, content, tool_name)
       VALUES (?,?,?,?,?,?)`,
      [userId, sessionKey, lang, role, (content || '').slice(0, 60_000), toolName || null]
    );
  } catch { /* logging must never break a request */ }
}

export function newSessionKey() {
  return crypto.randomUUID();
}