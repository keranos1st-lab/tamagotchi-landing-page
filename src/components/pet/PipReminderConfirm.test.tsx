// @ts-expect-error bun:test is supplied by the test runner
import { afterAll, beforeEach, describe, expect, jest, test } from 'bun:test';
import { Window } from 'happy-dom';

const g = globalThis as unknown as Record<string, unknown>;
const KEYS = ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'Node', 'Element', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'Event', 'CustomEvent', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
const saved: Record<string, PropertyDescriptor | undefined> = {};
const win = new Window({ url: 'http://localhost/' });
const w = win as unknown as Record<string, unknown>;
for (const k of KEYS) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
for (const k of KEYS) {
  if (k === 'window') g.window = win;
  else if (k === 'IS_REACT_ACT_ENVIRONMENT') g[k] = true;
  else if (k === 'fetch') continue;
  else if (k === 'requestAnimationFrame') g[k] = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16);
  else if (k === 'cancelAnimationFrame') g[k] = (id: number) => clearTimeout(id);
  else Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: k === 'getComputedStyle' ? (w[k] as () => unknown).bind(win) : w[k] });
}

const rtl = await import('@testing-library/react');
const { PipReminderConfirm } = await import('./PipReminderConfirm');
const { useAuthStore } = await import('@/store/authStore');
const { usePetStore } = await import('@/store/petStore');

afterAll(() => {
  rtl.cleanup();
  for (const k of KEYS) {
    if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!);
    else delete g[k];
  }
});

const proposal = { noteId: 80, dueLocal: '2026-10-14T14:00', tz: 'Asia/Vladivostok', lead: 15 as const, when: 'среда, 14 октября 2026, 14:00', tzLabel: 'Asia/Vladivostok, UTC+10:00', leadText: 'за 15 минут' };
const bodies: Array<Record<string, unknown>> = [];
let failWith: Record<string, unknown> | null = null;
const q = () => rtl.within(win.document.body as unknown as HTMLElement);
const wait = (ms = 40) => rtl.act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const add = (extra: Record<string, unknown> = {}, ts = Date.now()) => {
  const id = usePetStore.getState().addChatMessage('pet', 'Записал заметку номер 80', { reminderProposal: { ...proposal }, ...extra });
  usePetStore.getState().updateChatMessage(id, { timestamp: ts });
  return id;
};

beforeEach(() => {
  jest.useRealTimers();
  rtl.cleanup();
  bodies.length = 0;
  failWith = null;
  usePetStore.setState({ chatHistory: [] } as never);
  useAuthStore.getState().setSession('tok', { id: 1, email: 'a@example.invalid', createdAt: '' });
  g.fetch = (async (_u: string, init: RequestInit) => {
    bodies.push(JSON.parse(init.body as string));
    if (failWith) return { ok: false, status: 503, json: async () => failWith } as Response;
    return { ok: true, status: 200, json: async () => ({ ok: true, action: 'remind', note: { id: 80, text: 'x', version: 2, updatedAt: '2026-10-14T01:00:00+00:00', reminder: null }, changed: true }) } as Response;
  }) as typeof fetch;
});

describe('подтверждение напоминания в окне поверх окон', () => {
  test('нет предложения: ничего не показывается', () => {
    rtl.render(<PipReminderConfirm />);
    expect(q().queryByTestId('pip-reminder')).toBeNull();
  });

  test('свежее предложение показывается с кнопками, без «Изменить в блокноте»', async () => {
    add();
    rtl.render(<PipReminderConfirm />);
    await wait();
    expect(q().getByText('Поставить напоминание?')).toBeTruthy();
    expect(q().getByText(proposal.when)).toBeTruthy();
    expect(q().getByText('Поставить')).toBeTruthy();
    expect(q().getByText('Не нужно')).toBeTruthy();
    expect(q().queryByText('Изменить в блокноте')).toBeNull();
  });

  test('кнопка «Поставить» отправляет напоминание с токеном и помечает его сохранённым', async () => {
    const id = add();
    rtl.render(<PipReminderConfirm />);
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Поставить')); });
    await wait();
    const req = bodies.find((b) => b.notesApi === 'remind');
    expect(req).toBeTruthy();
    expect(req?.id).toBe(80);
    expect(JSON.stringify(req)).toContain('Asia/Vladivostok');
    expect(JSON.stringify(req)).toContain('2026-10-14T14:00');
    expect(usePetStore.getState().chatHistory.find((m) => m.id === id)?.reminderProposal?.state).toBe('saved');
    expect(q().getByText(/Напоминание сохранено/)).toBeTruthy();
  });

  test('«Не нужно» убирает предложение и не отправляет запрос', async () => {
    const id = add();
    rtl.render(<PipReminderConfirm />);
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Не нужно')); });
    await wait();
    expect(bodies.length).toBe(0);
    expect(usePetStore.getState().chatHistory.find((m) => m.id === id)?.reminderProposal?.state).toBe('dismissed');
    expect(q().queryByTestId('pip-reminder')).toBeNull();
  });

  test('ошибка сервера показывается, предложение остаётся для повтора', async () => {
    failWith = { error: 'notes_unavailable', message: 'Блокнот временно недоступен', retryable: true };
    const id = add();
    rtl.render(<PipReminderConfirm />);
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Поставить')); });
    await wait();
    expect(q().getByRole('alert').textContent).toContain('Блокнот временно недоступен');
    expect(q().getByText('Повторить')).toBeTruthy();
    expect(usePetStore.getState().chatHistory.find((m) => m.id === id)?.reminderProposal?.state).toBeUndefined();
  });

  test('давнее предложение не всплывает', async () => {
    add({}, Date.now() - 31 * 60 * 1000);
    rtl.render(<PipReminderConfirm />);
    await wait();
    expect(q().queryByTestId('pip-reminder')).toBeNull();
  });

  test('уже сохранённое или отклонённое не показывается заново', async () => {
    add({ reminderProposal: { ...proposal, state: 'dismissed' } });
    add({ reminderProposal: { ...proposal, state: 'saved' } });
    rtl.render(<PipReminderConfirm />);
    await wait();
    expect(q().queryByTestId('pip-reminder')).toBeNull();
  });

  test('при нескольких предложениях показывается последнее', async () => {
    add({ reminderProposal: { ...proposal, noteId: 1, when: 'первое' } });
    add({ reminderProposal: { ...proposal, noteId: 2, when: 'второе' } });
    rtl.render(<PipReminderConfirm />);
    await wait();
    expect(q().getByText('второе')).toBeTruthy();
    expect(q().queryByText('первое')).toBeNull();
  });
});
