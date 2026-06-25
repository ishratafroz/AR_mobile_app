// Local LLM conversational backend — Llama 3 (8B) running in Ollama on the paired
// PC, reached from the phone over USB via `adb reverse tcp:11434 tcp:11434` so the
// device's localhost:11434 forwards to the PC's Ollama. NO public cloud: the data
// goes only to the user's own trusted machine (acceptable for this research
// prototype; the meal *image* still never leaves the phone — only the small text
// factsheet built from on-device data is sent for phrasing).
//
// GROUNDED generation: we never ask the model for nutrition facts from memory (it
// hallucinates numbers). The caller passes a `facts` block compiled from the app's
// own data (log, RiskEngine, offline nutrition tables); the system prompt forces
// the model to answer ONLY from those facts. The LLM adds natural language and
// reasoning; the numbers stay correct because they come from the tables.

const HOST = 'http://localhost:11434';
const MODEL = 'llama3';          // Llama 3 8B instruct (Ollama tag)
const TIMEOUT_MS = 20000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

// Is the local Ollama server reachable AND does it have the model pulled?
export async function isLlamaAvailable() {
  try {
    const res = await withTimeout(fetch(`${HOST}/api/tags`), 4000);
    if (!res.ok) return false;
    const json = await res.json();
    const names = (json.models || []).map(m => m.name || '');
    return names.some(n => n.startsWith('llama3'));
  } catch (_) {
    return false;
  }
}

const SYSTEM_PROMPT =
  "You are a concise, friendly on-device diet assistant inside an AR food-tracking app. " +
  "Answer the user's question using ONLY the FACTS provided below — these come from the " +
  "user's own logged data and nutrition tables and are authoritative. NEVER invent calorie, " +
  "macro, or glycemic numbers; if a number isn't in the FACTS, say you don't have it rather " +
  "than guessing. Keep answers to 1-3 short sentences, practical and supportive. Do not give " +
  "medical diagnoses; you may relay the risk flags already computed in the FACTS.";

// messages: [{ role: 'user'|'assistant', content }]   facts: string factsheet
export async function chatLlama(messages, facts) {
  const body = {
    model: MODEL,
    stream: false,
    options: { temperature: 0.3, num_predict: 220 },
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nFACTS:\n${facts}` },
      ...messages,
    ],
  };
  const res = await withTimeout(
    fetch(`${HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const json = await res.json();
  const text = json?.message?.content?.trim();
  if (!text) throw new Error('Empty LLM response');
  return text;
}
