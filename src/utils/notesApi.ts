import func2url from '../../backend/func2url.json';
import { useAuthStore } from '@/store/authStore';

const URL = (func2url as Record<string, string>)['pet-chat'];
export const NOTES_CHANGED = 'petagent:notes-changed';
export const NOTES_OPEN = 'petagent:notes-open';
export const NOTE_MAX = 1800;

export type Note = { id: number; text: string; version: number; updatedAt: string };
export type NotesErr = { ok: false; code: string; message: string; retryable: boolean; status: number; current?: Note };
export type NotesList = { ok: true; notes: Note[]; total: number; offset: number; hasMore: boolean };
export type NoteSaved = { ok: true; action: 'create' | 'update'; note: Note; changed: boolean };

const emit = (name: string) => {
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(name));
  } catch {
    /* оповещение не должно ломать ответ */
  }
};
export const notifyNotesChanged = () => emit(NOTES_CHANGED);
export const openNotes = () => emit(NOTES_OPEN);
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

export const saveNote = (args: { id: number | null; text: string; expectedVersion?: number | null; requestId: string }) =>
  call<NoteSaved>({
    notesApi: 'save',
    id: args.id,
    text: args.text,
    expectedVersion: args.expectedVersion ?? null,
    requestId: args.requestId,
  });
