// @ts-expect-error bun:test is supplied by the test runner
import { beforeEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
const win = new Window({ url: 'https://localhost/' });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: win.localStorage });
const { listNotes, NOTES_CHANGED } = await import('./notesApi');
const { useAuthStore } = await import('@/store/authStore');
const { useNoteDraft } = await import('@/store/noteDraftStore');
const calls: Array<{ headers: Record<string, string>; body: Record<string, unknown> }> = [];
let status = 200;
let result: Record<string, unknown> = {};
const note = { id: 7, text: 'позвонить Сергею', version: 1, updatedAt: '2026-10-11T10:00:00+00:00' };
beforeEach(() => {
  calls.length = 0;
  status = 200;
  result = { ok: true, notes: [note], total: 1, offset: 0, hasMore: false };
  useNoteDraft.getState().discard();
  useAuthStore.getState().setSession('tok-123', { id: 1, email: 'a@example.invalid', createdAt: '' });
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    calls.push({ headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
    return { ok: status === 200, status, json: async () => result } as Response;
  }) as typeof fetch;
});
test('list sends the session token and query, never a user id', async () => {
  const r = await listNotes({ query: 'Сергея' });
  expect(r.ok).toBe(true);
  expect(calls[0].headers['X-Auth-Token']).toBe('tok-123');
  expect(calls[0].body).toMatchObject({ notesApi: 'list', query: 'Сергея', offset: 0 });
  expect('userId' in calls[0].body).toBe(false);
});
test('without a session no request is sent', async () => {
  useAuthStore.getState().clearSession();
  const r = await listNotes({});
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.code).toBe('notes_login');
  expect(calls.length).toBe(0);
});
test('save of an existing note sends the exact id and version', async () => {
  result = { ok: true, action: 'update', note: { ...note, version: 2 }, changed: true };
  useNoteDraft.getState().begin(note);
  useNoteDraft.getState().setText('позвонить Сергею в 15:00');
  const saved = await useNoteDraft.getState().save();
  expect(saved?.version).toBe(2);
  expect(calls[0].body).toMatchObject({ notesApi: 'save', id: 7, expectedVersion: 1, text: 'позвонить Сергею в 15:00' });
  expect(useNoteDraft.getState().active).toBe(false);
});
test('a failed save keeps the typed text and is not reported as saved', async () => {
  status = 503;
  result = { error: 'notes_unavailable', message: 'Блокнот временно недоступен', retryable: true };
  useNoteDraft.getState().begin(null);
  useNoteDraft.getState().setText('важный текст');
  const saved = await useNoteDraft.getState().save();
  const s = useNoteDraft.getState();
  expect(saved).toBe(null);
  expect(s.text).toBe('важный текст');
  expect(s.active).toBe(true);
  expect(s.error?.retryable).toBe(true);
});
test('retry after a failure reuses the same request id', async () => {
  status = 503;
  result = { error: 'notes_unavailable', message: 'x', retryable: true };
  useNoteDraft.getState().begin(null);
  useNoteDraft.getState().setText('текст');
  await useNoteDraft.getState().save();
  await useNoteDraft.getState().save();
  expect(calls[0].body.requestId).toBe(calls[1].body.requestId);
});
test('empty text is rejected without a request', async () => {
  useNoteDraft.getState().begin(null);
  useNoteDraft.getState().setText('   ');
  expect(await useNoteDraft.getState().save()).toBe(null);
  expect(calls.length).toBe(0);
});
test('a voice note command announces a change so an open list refreshes', async () => {
  const { askPet } = await import('./petAi');
  let fired = 0;
  const g = globalThis as unknown as { window?: unknown; Event: unknown };
  g.window = win;
  g.Event = win.Event;
  win.addEventListener(NOTES_CHANGED, () => fired++);
  result = { reply: 'Записал', noteAction: 'create', notes: [note] };
  const pet = { name: 'Кодик', type: 'cat' as const, level: 1, stage: 'baby' as const, hunger: 70, happiness: 70, energy: 80, health: 100, intelligence: 100 };
  const r = await askPet({ pet, history: [], memory: [], message: 'Запиши заметку: тест', requestId: 'voice-req-0001' });
  expect(r.ok).toBe(true);
  expect(fired).toBe(1);
});
