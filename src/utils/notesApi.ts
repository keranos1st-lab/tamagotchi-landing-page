import func2url from '../../backend/func2url.json';
import { useAuthStore } from '@/store/authStore';

const URL = (func2url as Record<string, string>)['pet-chat'];
export const NOTES_CHANGED = 'petagent:notes-changed';
export const NOTES_OPEN = 'petagent:notes-open';
export const REMINDER_PRESETS: { lead: Lead; label: string }[] = [
  { lead: 15, label: 'За 15 минут' },
  { lead: 30, label: 'За 30 минут' },
  { lead: 0, label: 'В указанное время' },
];
export const NOTE_MAX = 1800;

export type Lead = 0 | 15 | 30;
export type Reminder = {
  dueAt: string;
  dueLocal: string;
  tz: string;
  tzLabel: string;
  lead: Lead;
  leadText: string;
  remindAt: string | null;
  state: 'active' | 'done';
  seq: number;
  when: string;
  text: string;
};
export type ReminderInput = { dueLocal: string; tz: string; lead: Lead };
export type Note = { id: number; text: string; version: number; updatedAt: string; reminder?: Reminder | null };
export type ReminderProposal = { noteId: number; dueLocal: string; tz: string; lead: Lead; when: string; tzLabel: string; leadText: string };
export type NotesErr = { ok: false; code: string; message: string; retryable: boolean; status: number; current?: Note };
export type NotesList = { ok: true; notes: Note[]; total: number; offset: number; hasMore: boolean };
export type NoteSaved = { ok: true; action: 'create' | 'update' | 'remind'; note: Note; changed: boolean };
export type NotesDue = { ok: true; notes: Note[]; next: string | null; serverNow: string };
export type NoteAcked = { ok: true; action: 'done' | 'snooze'; note: Note; changed: boolean; stale: boolean };

const emit = (name: string) => {
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(name));
  } catch {
    /* оповещение не должно ломать ответ */
  }
};
export const notifyNotesChanged = () => emit(NOTES_CHANGED);
export const openNotes = () => emit(NOTES_OPEN);

export function userTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return tz;
  } catch {
    /* нет Intl */
  }
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const defaultDueLocal = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(new Date(d.getTime() + 60 * 60 * 1000));
};
export const formatDue = (r: Reminder) => `${r.when} (${r.tzLabel})`;
export const newRequestId = () => `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;

const LOGIN: NotesErr = { ok: false, code: 'notes_login', message: 'Войди в аккаунт PetAgent, чтобы пользоваться заметками.', retryable: false, status: 401 };

async function call<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T | NotesErr> {
  const token = useAuthStore.getState().token;
  if (!token) return LOGIN;
  if (!URL) return { ok: false, code: 'no_function', message: 'Серверная функция не опубликована', retryable: false, status: 0 };
  try {
    const res = await fetch(URL, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) return data as T;
    return {
      ok: false,
      code: data?.error ?? `http_${res.status}`,
      message: data?.message ?? `Ошибка сервера (${res.status})`,
      retryable: data?.retryable ?? res.status >= 500,
      status: res.status,
      current: data?.current,
    };
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    return { ok: false, code: 'network', message: 'Нет связи с сервером. Проверь интернет и повтори.', retryable: true, status: 0 };
  }
}

export const listNotes = (args: { query?: string; offset?: number; signal?: AbortSignal }) =>
  call<NotesList>({ notesApi: 'list', query: args.query ?? '', offset: args.offset ?? 0 }, args.signal);

export const saveNote = (args: { id: number | null; text: string; expectedVersion?: number | null; requestId: string; reminder?: ReminderInput | null | undefined }) =>
  call<NoteSaved>({
    notesApi: 'save',
    id: args.id,
    text: args.text,
    expectedVersion: args.expectedVersion ?? null,
    requestId: args.requestId,
    ...(args.reminder === undefined ? {} : { reminder: args.reminder }),
  });

export const setReminder = (args: { id: number; reminder: ReminderInput | null; requestId: string }) =>
  call<NoteSaved>({ notesApi: 'remind', id: args.id, reminder: args.reminder, requestId: args.requestId });

export const fetchDue = (signal?: AbortSignal) => call<NotesDue>({ notesApi: 'due' }, signal);

export const ackReminder = (args: { id: number; seq: number; mode: 'done' | 'snooze'; requestId: string }) =>
  call<NoteAcked>({ notesApi: 'ack', ...args });
