// @ts-expect-error bun:test is supplied by the test runner
import { afterAll, beforeEach, expect, test } from 'bun:test';
import { snapshotGlobals } from '@/test/isolate';
const restoreGlobals = snapshotGlobals();
afterAll(restoreGlobals);
const { useAuthStore } = await import('@/store/authStore');
const { useNoteDraft } = await import('@/store/noteDraftStore');
const { useReminderStore } = await import('@/store/reminderStore');

type R = { dueAt: string; dueLocal: string; tz: string; tzLabel: string; lead: number; leadText: string; remindAt: string; state: 'active' | 'done'; seq: number; when: string; text: string };
const rem = (seq = 1, state: 'active' | 'done' = 'active'): R => ({ dueAt: '2026-10-12T09:00:00+00:00', dueLocal: '2026-10-12T12:00', tz: 'Europe/Moscow', tzLabel: 'Europe/Moscow, UTC+03:00', lead: 15, leadText: 'за 15 минут', remindAt: '2026-10-12T08:45:00+00:00', state, seq, when: 'понедельник, 12 октября 2026, 12:00', text: 'x' });
const note = (id: number, seq = 1, text = 'позвонить Сергею') => ({ id, text, version: 2, updatedAt: '2026-10-11T10:00:00+00:00', reminder: rem(seq) });

const calls: Array<{ headers: Record<string, string>; body: Record<string, unknown> }> = [];
let due: unknown[] = [];
let failAck = false;
let nextAck: Record<string, unknown> | null = null;

beforeEach(() => {
  calls.length = 0;
  due = [];
  failAck = false;
  nextAck = null;
  useReminderStore.getState().clear();
  useNoteDraft.getState().discard();
  useAuthStore.getState().setSession('tok-1', { id: 1, email: 'a@example.invalid', createdAt: '' });
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    calls.push({ headers: init.headers as Record<string, string>, body });
    if (body.notesApi === 'due') return { ok: true, status: 200, json: async () => ({ ok: true, notes: due, next: null, serverNow: '2026-10-12T09:00:00+00:00' }) } as Response;
    if (body.notesApi === 'ack') {
      if (failAck) return { ok: false, status: 503, json: async () => ({ error: 'notes_unavailable', message: 'Блокнот временно недоступен', retryable: true }) } as Response;
      return { ok: true, status: 200, json: async () => nextAck ?? { ok: true, action: body.mode, note: note(body.id, body.seq + 1), changed: true, stale: false } } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, action: 'update', note: note(7), changed: true }) } as Response;
  }) as typeof fetch;
});

test('сработавшее напоминание попадает в очередь один раз', async () => {
  due = [note(5, 3)];
  await useReminderStore.getState().poll();
  await useReminderStore.getState().poll();
  expect(useReminderStore.getState().queue.length).toBe(1);
  expect(useReminderStore.getState().queue[0].note.text).toBe('позвонить Сергею');
});

test('«Готово» отправляет точный id и seq и убирает карточку', async () => {
  due = [note(5, 3)];
  await useReminderStore.getState().poll();
  await useReminderStore.getState().act('done');
  const ack = calls.find((c) => c.body.notesApi === 'ack')!;
  expect(ack.body).toMatchObject({ id: 5, seq: 3, mode: 'done' });
  expect(ack.headers['X-Auth-Token']).toBe('tok-1');
  expect('userId' in ack.body).toBe(false);
  expect(useReminderStore.getState().queue.length).toBe(0);
});

test('«Отложить» отправляет mode=snooze', async () => {
  due = [note(5, 3)];
  await useReminderStore.getState().poll();
  await useReminderStore.getState().act('snooze');
  expect(calls.find((c) => c.body.notesApi === 'ack')!.body).toMatchObject({ id: 5, seq: 3, mode: 'snooze' });
});

test('после ответа сервера то же напоминание не появляется снова, даже если сервер его ещё отдаёт', async () => {
  due = [note(5, 3)];
  await useReminderStore.getState().poll();
  await useReminderStore.getState().act('snooze');
  await useReminderStore.getState().poll();
  expect(useReminderStore.getState().queue.length).toBe(0);
});

test('после «Отложить» новое срабатывание (новый seq) показывается снова', async () => {
  due = [note(5, 3)];
  await useReminderStore.getState().poll();
  await useReminderStore.getState().act('snooze');
  due = [note(5, 4)];
  await useReminderStore.getState().poll();
  expect(useReminderStore.getState().queue.length).toBe(1);
  expect(useReminderStore.getState().queue[0].note.reminder!.seq).toBe(4);
});

test('ошибка сети не убирает карточку и не считается выполненной', async () => {
  due = [note(5, 3)];
  await useReminderStore.getState().poll();
  failAck = true;
  await useReminderStore.getState().act('done');
  const s = useReminderStore.getState();
  expect(s.queue.length).toBe(1);
  expect(s.error?.retryable).toBe(true);
  expect(s.busy).toBe(false);
  failAck = false;
  await s.act('done');
  expect(useReminderStore.getState().queue.length).toBe(0);
});

test('быстрый двойной клик отправляет одно подтверждение', async () => {
  due = [note(5, 3)];
  await useReminderStore.getState().poll();
  await Promise.all([useReminderStore.getState().act('done'), useReminderStore.getState().act('done')]);
  expect(calls.filter((c) => c.body.notesApi === 'ack').length).toBe(1);
});

test('если заметку уже закрыли на другом устройстве, карточка исчезает после опроса', async () => {
  due = [note(5, 3)];
  await useReminderStore.getState().poll();
  due = [];
  await useReminderStore.getState().poll();
  expect(useReminderStore.getState().queue.length).toBe(0);
});

test('выполненное (done) напоминание не показывается', async () => {
  due = [{ ...note(5, 3), reminder: rem(3, 'done') }];
  await useReminderStore.getState().poll();
  expect(useReminderStore.getState().queue.length).toBe(0);
});

test('без входа запросов нет', async () => {
  useAuthStore.getState().clearSession();
  const res = await useReminderStore.getState().poll();
  expect(res).toBe(null);
  expect(calls.length).toBe(0);
});

test('правка только текста не отправляет поле reminder', async () => {
  useNoteDraft.getState().begin(note(7) as never);
  useNoteDraft.getState().setText('новый текст');
  await useNoteDraft.getState().save();
  const save = calls.find((c) => c.body.notesApi === 'save')!;
  expect('reminder' in save.body).toBe(false);
  expect(save.body).toMatchObject({ id: 7, expectedVersion: 2, text: 'новый текст' });
});

test('изменение времени отправляет дату, пояс и «заранее»', async () => {
  useNoteDraft.getState().begin(note(7) as never);
  useNoteDraft.getState().setDue('2026-10-13T15:30');
  useNoteDraft.getState().setLead(30);
  await useNoteDraft.getState().save();
  const save = calls.find((c) => c.body.notesApi === 'save')!;
  expect(save.body.reminder).toMatchObject({ dueLocal: '2026-10-13T15:30', lead: 30 });
  expect(typeof (save.body.reminder as { tz: string }).tz).toBe('string');
  expect((save.body.reminder as { tz: string }).tz.length).toBeGreaterThan(2);
});

test('выключение напоминания отправляет reminder: null', async () => {
  useNoteDraft.getState().begin(note(7) as never);
  useNoteDraft.getState().setRemindOn(false);
  await useNoteDraft.getState().save();
  const save = calls.find((c) => c.body.notesApi === 'save')!;
  expect(save.body.reminder).toBe(null);
});

test('новая обычная заметка уходит без напоминания', async () => {
  useNoteDraft.getState().begin(null);
  useNoteDraft.getState().setText('добавить анимацию');
  await useNoteDraft.getState().save();
  const save = calls.find((c) => c.body.notesApi === 'save')!;
  expect(save.body.id).toBe(null);
  expect('reminder' in save.body).toBe(false);
});

test('по умолчанию напоминание «за 15 минут»', () => {
  useNoteDraft.getState().begin(null);
  expect(useNoteDraft.getState().lead).toBe(15);
  expect(useNoteDraft.getState().remindOn).toBe(false);
});

test('ошибка сохранения напоминания оставляет введённые значения', async () => {
  globalThis.fetch = (async () => ({ ok: false, status: 400, json: async () => ({ error: 'reminder_past', message: 'Это время уже прошло.', retryable: false }) }) as Response) as typeof fetch;
  useNoteDraft.getState().begin(null);
  useNoteDraft.getState().setText('позвонить');
  useNoteDraft.getState().setDue('2020-01-01T10:00');
  const saved = await useNoteDraft.getState().save();
  const s = useNoteDraft.getState();
  expect(saved).toBe(null);
  expect(s.text).toBe('позвонить');
  expect(s.dueLocal).toBe('2020-01-01T10:00');
  expect(s.error?.code).toBe('reminder_past');
  expect(s.active).toBe(true);
});
