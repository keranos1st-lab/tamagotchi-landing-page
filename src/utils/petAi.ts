import func2url from '../../backend/func2url.json';
import type { ChatMessage, PetState, TextAction } from '@/store/petStore';
import { ownKeyHeaders, type AiProvider } from '@/store/aiKeyStore';

export type AiSource = { title: string; url: string; domain: string; date?: string };
export type AiOk = {
  ok: true;
  reply: string;
  remember: string | null;
  truncated: boolean;
  remainingToday?: number;
  ownKey?: boolean;
  declined?: boolean;
  searched?: boolean;
  verified?: boolean;
  sources?: AiSource[];
  spoken?: string;
  asOf?: string;
};
export type AiErr = { ok: false; code: string; message: string; retryable: boolean };
export type AiCancelled = { ok: false; cancelled: true; code: 'cancelled'; message: string; retryable: false };
export type AiResult = AiOk | AiErr | AiCancelled;

export const aiConfig = { timeoutMs: 40000 };
const AI_CANCELLED: AiCancelled = { ok: false, cancelled: true, code: 'cancelled', message: 'Запрос остановлен', retryable: false };

export interface AiStatus {
  configured: boolean;
  model?: string;
  limits?: { perMinute: number; perDay: number; maxMessage: number; maxSource: number };
  usedToday?: number;
  remainingToday?: number;
  budgetOk?: boolean;
}

const URL = (func2url as Record<string, string>)['pet-chat'];
export const MAX_MESSAGE = 2000;
export const MAX_SOURCE = 6000;

export const TEXT_ACTIONS: Record<TextAction, { label: string; verb: string; icon: string }> = {
  explain: { label: 'Объясни', verb: 'Объяснить', icon: 'Lightbulb' },
  shorten: { label: 'Сократи', verb: 'Сократить', icon: 'Scissors' },
  fix: { label: 'Исправь', verb: 'Исправить', icon: 'SpellCheck' },
  reply: { label: 'Помоги ответить', verb: 'Помочь ответить', icon: 'Reply' },
};

export function clientId(): string {
  const k = 'petagent-client-id';
  let id = localStorage.getItem(k);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9-]/g, '');
    localStorage.setItem(k, id);
  }
  return id;
}

function userTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

const NETWORK: AiErr = { ok: false, code: 'network', message: 'Нет связи с сервером', retryable: true };

export async function fetchAiStatus(): Promise<AiStatus | null> {
  if (!URL) return { configured: false };
  try {
    const r = await fetch(URL, { headers: { 'X-Client-Id': clientId() } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

type PetCtx = Pick<PetState, 'name' | 'type' | 'level' | 'stage' | 'hunger' | 'happiness' | 'energy' | 'health' | 'intelligence'>;

export async function askPet(args: {
  pet: PetCtx;
  history: ChatMessage[];
  memory: string[];
  message: string;
  task?: { action: TextAction; source: string };
  voice?: boolean;
  signal?: AbortSignal;
}): Promise<AiResult> {
  if (args.signal?.aborted) return AI_CANCELLED;
  if (!URL) return { ok: false, code: 'no_function', message: 'Серверная функция pet-chat не опубликована', retryable: false };
  const { pet, history, memory, message, task, voice } = args;
  const { signal } = args;
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, aiConfig.timeoutMs);
  const onUserAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onUserAbort);
  const cancelled = () => !!signal?.aborted;
  try {
    const res = await fetch(URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId(), ...ownKeyHeaders() },
      body: JSON.stringify({
        message,
        task,
        voice: voice || undefined,
        timezone: userTimezone(),
        tzOffset: -new Date().getTimezoneOffset(),
        memory,
        history: history
          .filter((m) => m.kind !== 'error' && m.kind !== 'legacy')
          .slice(-10)
          .map((m) => ({ role: m.role, text: m.task ? `[${TEXT_ACTIONS[m.task.action].label}] ${m.task.source.slice(0, 600)}` : m.text })),
        pet: {
          name: pet.name,
          type: pet.type,
          level: pet.level,
          stage: pet.stage,
          iq: Math.round(pet.intelligence),
          stats: { hunger: pet.hunger, happiness: pet.happiness, energy: pet.energy, health: pet.health },
        },
      }),
    });
    if (cancelled()) return AI_CANCELLED;
    const data = await res.json().catch(() => null);
    if (cancelled()) return AI_CANCELLED;
    if (res.ok && data?.reply) {
      return {
        ok: true,
        reply: data.reply,
        remember: data.remember ?? null,
        truncated: !!data.truncated,
        remainingToday: data.remainingToday,
        ownKey: !!data.ownKey,
        declined: !!data.declined,
        searched: data.searched || undefined,
        verified: data.searched ? !!data.verified : undefined,
        sources: Array.isArray(data.sources) && data.sources.length ? data.sources : undefined,
        spoken: typeof data.spoken === 'string' && data.spoken ? data.spoken : undefined,
        asOf: typeof data.asOf === 'string' ? data.asOf : undefined,
      };
    }
    if (data?.error) return { ok: false, code: data.error, message: data.message || 'Ошибка AI', retryable: !!data.retryable };
    if (res.status === 504 || res.status === 502) return { ok: false, code: 'timeout', message: 'AI не успел ответить', retryable: true };
    return { ok: false, code: `http_${res.status}`, message: `Ошибка сервера (${res.status})`, retryable: true };
  } catch (e) {
    if (cancelled()) return AI_CANCELLED;
    if (timedOut || (e as Error).name === 'AbortError') return { ok: false, code: 'timeout', message: 'AI не успел ответить', retryable: true };
    return NETWORK;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onUserAbort);
  }
}

export async function checkOwnKey(provider: AiProvider, key: string, model: string): Promise<{ ok: true; model: string } | AiErr> {
  if (!URL) return { ok: false, code: 'no_function', message: 'Серверная функция pet-chat не опубликована', retryable: false };
  const headers: Record<string, string> = { 'X-User-Ai-Key': key.trim(), 'X-User-Ai-Provider': provider };
  if (model.trim()) headers['X-User-Ai-Model'] = model.trim();
  try {
    const r = await fetch(`${URL}?check=1`, { headers });
    const d = await r.json().catch(() => null);
    if (r.ok && d?.ok) return { ok: true, model: d.model };
    return { ok: false, code: d?.error ?? `http_${r.status}`, message: d?.message ?? 'Не удалось проверить ключ', retryable: !!d?.retryable };
  } catch {
    return NETWORK;
  }
}
