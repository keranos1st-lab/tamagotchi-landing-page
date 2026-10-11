// @ts-expect-error bun:test is supplied by the test runner
import { afterAll, beforeEach, describe, expect, jest, test } from 'bun:test';
import { Window } from 'happy-dom';

const g = globalThis as unknown as Record<string, unknown>;
const KEYS = ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'Node', 'Element', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'Event', 'CustomEvent', 'KeyboardEvent', 'NodeFilter', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLButtonElement', 'DocumentFragment', 'FocusEvent', 'MouseEvent', 'PointerEvent', 'IS_REACT_ACT_ENVIRONMENT'];
const saved: Record<string, PropertyDescriptor | undefined> = {};
const win = new Window({ url: 'http://localhost/' });
const w = win as unknown as Record<string, unknown>;
for (const k of KEYS) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
for (const k of KEYS) {
  if (k === 'window') g.window = win;
  else if (k === 'IS_REACT_ACT_ENVIRONMENT') g[k] = true;
  else if (k === 'requestAnimationFrame') g[k] = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16);
  else if (k === 'cancelAnimationFrame') g[k] = (id: number) => clearTimeout(id);
  else Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: k === 'getComputedStyle' ? (w[k] as () => unknown).bind(win) : w[k] });
}

const rtl = await import('@testing-library/react');
const { ReminderAlert } = await import('./ReminderAlert');
const { ReminderProposalCard } = await import('../chat/ReminderProposalCard');
const { useAuthStore } = await import('@/store/authStore');
const { usePetStore } = await import('@/store/petStore');
const { useReminderStore } = await import('@/store/reminderStore');

afterAll(() => {
  rtl.cleanup();
  for (const k of KEYS) {
    if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!);
    else delete g[k];
  }
});

const rem = (seq: number) => ({ dueAt: '2026-10-12T09:00:00+00:00', dueLocal: '2026-10-12T12:00', tz: 'Europe/Moscow', tzLabel: 'Europe/Moscow, UTC+03:00', lead: 15, leadText: 'за 15 минут', remindAt: '2026-10-12T08:45:00+00:00', state: 'active' as const, seq, when: 'понедельник, 12 октября 2026, 12:00', text: 't' });
const note = (id: number, seq: number, text: string) => ({ id, text, version: 2, updatedAt: '2026-10-11T10:00:00+00:00', reminder: rem(seq) });
const bodies: Array<Record<string, unknown>> = [];
let due: unknown[] = [];
let failAck = false;
const q = () => rtl.within(win.document.body as unknown as HTMLElement);
const wait = (ms = 40) => rtl.act(async () => { await new Promise((r) => setTimeout(r, ms)); });

beforeEach(async () => {
  jest.useRealTimers();
  rtl.cleanup();
  useReminderStore.getState().clear();
  bodies.length = 0;
  due = [];
  failAck = false;
  useAuthStore.getState().setSession('tok', { id: 1, email: 'a@example.invalid', createdAt: '' });
  g.fetch = (async (_u: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    bodies.push(body);
    if (body.notesApi === 'due') return { ok: true, status: 200, json: async () => ({ ok: true, notes: due, next: null, serverNow: '2026-10-12T09:00:00+00:00' }) } as Response;
    if (body.notesApi === 'ack') {
      if (failAck) return { ok: false, status: 503, json: async () => ({ error: 'notes_unavailable', message: 'Блокнот временно недоступен', retryable: true }) } as Response;
      due = [];
      return { ok: true, status: 200, json: async () => ({ ok: true, action: body.mode, note: note(body.id, body.seq + 1, 'x'), changed: true, stale: false }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, action: 'remind', note: note(body.id, 2, 'x'), changed: true }) } as Response;
  }) as typeof fetch;
});

describe('сигнал Кодика', () => {
  test('показывает текст заметки и обе кнопки', async () => {
    due = [note(5, 3, 'Позвонить Сергею в 12 дня')];
    rtl.render(<ReminderAlert />);
    await wait();
    expect(q().getByText('Позвонить Сергею в 12 дня')).toBeTruthy();
    expect(q().getByText('Готово')).toBeTruthy();
    expect(q().getByText('Отложить на 15 минут')).toBeTruthy();
    expect(win.document.body.textContent).toContain('UTC+03:00');
  });

  test('«Готово» убирает карточку и не показывает её снова', async () => {
    due = [note(5, 3, 'Позвонить Сергею')];
    rtl.render(<ReminderAlert />);
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Готово')); });
    await wait();
    expect(bodies.find((b) => b.notesApi === 'ack')).toMatchObject({ id: 5, seq: 3, mode: 'done' });
    expect(win.document.body.textContent).not.toContain('Позвонить Сергею');
    await rtl.act(async () => { await useReminderStore.getState().poll(); });
    expect(useReminderStore.getState().queue.length).toBe(0);
  });

  test('«Отложить на 15 минут» шлёт snooze', async () => {
    due = [note(5, 3, 'Позвонить Сергею')];
    rtl.render(<ReminderAlert />);
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Отложить на 15 минут')); });
    await wait();
    expect(bodies.find((b) => b.notesApi === 'ack')).toMatchObject({ id: 5, mode: 'snooze' });
  });

  test('при ошибке карточка остаётся и показывает причину', async () => {
    due = [note(5, 3, 'Позвонить Сергею')];
    failAck = true;
    rtl.render(<ReminderAlert />);
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Готово')); });
    await wait();
    expect(win.document.body.textContent).toContain('Блокнот временно недоступен');
    expect(q().getByText('Позвонить Сергею')).toBeTruthy();
  });

  test('без входа ничего не показывается и не опрашивается', async () => {
    useAuthStore.getState().clearSession();
    rtl.render(<ReminderAlert />);
    await wait();
    expect(win.document.body.textContent).not.toContain('Готово');
    expect(bodies.length).toBe(0);
  });
});

describe('предложение напоминания в чате', () => {
  const proposal = { noteId: 7, dueLocal: '2026-10-12T12:00', tz: 'Europe/Moscow', lead: 15 as const, when: 'понедельник, 12 октября 2026, 12:00', tzLabel: 'Europe/Moscow, UTC+03:00', leadText: 'за 15 минут', state: 'pending' as const };
  const mount = () => {
    usePetStore.setState({ chatHistory: [] });
    const id = usePetStore.getState().addChatMessage('pet', 'Записал', { kind: 'ai', reminderProposal: proposal });
    const Live = () => {
      const msg = usePetStore((st) => st.chatHistory.find((m) => m.id === id));
      return msg?.reminderProposal ? <ReminderProposalCard msgId={id} proposal={msg.reminderProposal} /> : null;
    };
    rtl.render(<Live />);
    return id;
  };

  test('показывает конкретные дату, время и часовой пояс', () => {
    mount();
    expect(win.document.body.textContent).toContain('понедельник, 12 октября 2026, 12:00');
    expect(win.document.body.textContent).toContain('Europe/Moscow, UTC+03:00');
    expect(win.document.body.textContent).toContain('за 15 минут');
  });

  test('напоминание сохраняется только после нажатия «Поставить» и ответа сервера', async () => {
    mount();
    expect(bodies.length).toBe(0);
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Поставить')); });
    await wait();
    expect(bodies[0]).toMatchObject({ notesApi: 'remind', id: 7, reminder: { dueLocal: '2026-10-12T12:00', tz: 'Europe/Moscow', lead: 15 } });
    expect(win.document.body.textContent).toContain('Напоминание сохранено');
  });

  test('«Не нужно» ничего не отправляет', async () => {
    mount();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Не нужно')); });
    expect(bodies.length).toBe(0);
    expect(win.document.body.textContent).toContain('сохранена как обычная');
  });
});
