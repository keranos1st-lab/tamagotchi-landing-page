import func2url from '../../backend/func2url.json';
import type { ChatMessage, PetState, TextAction } from '@/store/petStore';

export type AiOk = { ok: true; reply: string; remember: string | null; truncated: boolean; remainingToday?: number };
export type AiErr = { ok: false; code: string; message: string; retryable: boolean };
export type AiResult = AiOk | AiErr;

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

type PetCtx = Pick<PetState, 'name' | 'type' | 'level' | 'stage' | 'hunger' | 'happiness' | 'energy' | 'health'>;

export async function askPet(args: {
  pet: PetCtx;
  history: ChatMessage[];
  memory: string[];
  message: string;
  task?: { action: TextAction; source: string };
}): Promise<AiResult> {
  if (!URL) return { ok: false, code: 'no_function', message: 'Серверная функция pet-chat не опубликована', retryable: false };
  const { pet, history, memory, message, task } = args;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40000);
  try {
    const res = await fetch(URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId() },
      body: JSON.stringify({
        message,
        task,
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
          stats: { hunger: pet.hunger, happiness: pet.happiness, energy: pet.energy, health: pet.health },
        },
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.reply) {
      return { ok: true, reply: data.reply, remember: data.remember ?? null, truncated: !!data.truncated, remainingToday: data.remainingToday };
    }
    if (data?.error) return { ok: false, code: data.error, message: data.message || 'Ошибка AI', retryable: !!data.retryable };
    if (res.status === 504 || res.status === 502) return { ok: false, code: 'timeout', message: 'AI не успел ответить', retryable: true };
    return { ok: false, code: `http_${res.status}`, message: `Ошибка сервера (${res.status})`, retryable: true };
  } catch (e) {
    if ((e as Error).name === 'AbortError') return { ok: false, code: 'timeout', message: 'AI не успел ответить', retryable: true };
    return NETWORK;
  } finally {
    clearTimeout(timer);
  }
}
