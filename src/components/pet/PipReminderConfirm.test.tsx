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
let failTimes = Infinity;
const seen = new Map<string, string>();
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
  failTimes = Infinity;
  seen.clear();
  usePetStore.setState({ chatHistory: [] } as never);
  useAuthStore.getState().setSession('tok', { id: 1, email: 'a@example.invalid', createdAt: '' });
  g.fetch = (async (_u: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    bodies.push(body);
    if (failWith && failTimes-- > 0) return { ok: false, status: 503, json: async () => failWith } as Response;
    const digest = JSON.stringify({ id: body.id, reminder: body.reminder });
    const prev = seen.get(body.requestId);
    if (prev !== undefined && prev !== digest) {
      return { ok: false, status: 409, json: async () => ({ error: 'notes_request_conflict', message: 'Этот запрос уже использован для другого действия.', retryable: false }) } as Response;
    }
    seen.set(body.requestId, digest);
    return { ok: true, status: 200, json: async () => ({ ok: true, action: 'remind', note: { id: body.id, text: 'x', version: 2, updatedAt: '2026-10-14T01:00:00+00:00', reminder: null }, changed: true }) } as Response;
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

  test('два предложения подряд: после подтверждения первого второе тоже сохраняется без 409', async () => {
    const first = add({ reminderProposal: { ...proposal, noteId: 80, when: 'первое' } });
    rtl.render(<PipReminderConfirm />);
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Поставить')); });
    await wait();
    expect(usePetStore.getState().chatHistory.find((m) => m.id === first)?.reminderProposal?.state).toBe('saved');

    const second = add({ reminderProposal: { ...proposal, noteId: 81, when: 'второе' } });
    await wait();
    expect(q().getByText('второе')).toBeTruthy();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Поставить')); });
    await wait();

    expect(usePetStore.getState().chatHistory.find((m) => m.id === second)?.reminderProposal?.state).toBe('saved');
    expect(q().queryByRole('alert')).toBeNull();
    const sent = bodies.filter((b) => b.notesApi === 'remind');
    expect(sent.map((b) => b.id)).toEqual([80, 81]);
    expect(sent[0].requestId).not.toBe(sent[1].requestId);
  });

  test('два предложения: подтверждаем последнее, затем предыдущее — оба сохраняются без 409', async () => {
    const older = add({ reminderProposal: { ...proposal, noteId: 90, when: 'старое' } });
    const newer = add({ reminderProposal: { ...proposal, noteId: 91, when: 'новое' } });
    rtl.render(<PipReminderConfirm />);
    await wait();
    expect(q().getByText('новое')).toBeTruthy();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Поставить')); });
    await wait();
    expect(usePetStore.getState().chatHistory.find((m) => m.id === newer)?.reminderProposal?.state).toBe('saved');

    await wait();
    expect(q().getByText('старое')).toBeTruthy();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Поставить')); });
    await wait();

    expect(usePetStore.getState().chatHistory.find((m) => m.id === older)?.reminderProposal?.state).toBe('saved');
    expect(q().queryByRole('alert')).toBeNull();
    const sent = bodies.filter((b) => b.notesApi === 'remind');
    expect(sent.map((b) => b.id)).toEqual([91, 90]);
    expect(sent[0].requestId).not.toBe(sent[1].requestId);
  });

  test('повтор для того же предложения сохраняет прежний requestId', async () => {
    failWith = { error: 'notes_unavailable', message: 'Блокнот временно недоступен', retryable: true };
    failTimes = 1;
    add({ reminderProposal: { ...proposal, noteId: 95 } });
    rtl.render(<PipReminderConfirm />);
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Поставить')); });
    await wait();
    expect(q().getByText('Повторить')).toBeTruthy();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Повторить')); });
    await wait();

    const sent = bodies.filter((b) => b.notesApi === 'remind');
    expect(sent.length).toBe(2);
    expect(sent[0].requestId).toBeTruthy();
    expect(sent[1].requestId).toBe(sent[0].requestId);
    expect(q().getByText(/Напоминание сохранено/)).toBeTruthy();
  });

  test('«Не нужно» для одного предложения не мешает подтвердить следующее', async () => {
    const a = add({ reminderProposal: { ...proposal, noteId: 70, when: 'отменённое' } });
    rtl.render(<PipReminderConfirm />);
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Не нужно')); });
    await wait();
    expect(bodies.length).toBe(0);
    expect(usePetStore.getState().chatHistory.find((m) => m.id === a)?.reminderProposal?.state).toBe('dismissed');
    expect(usePetStore.getState().chatHistory.find((m) => m.id === a)?.text).toBe('Записал заметку номер 80');

    const b = add({ reminderProposal: { ...proposal, noteId: 71, when: 'следующее' } });
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Поставить')); });
    await wait();
    expect(usePetStore.getState().chatHistory.find((m) => m.id === b)?.reminderProposal?.state).toBe('saved');
    expect(q().queryByRole('alert')).toBeNull();
  });

  test('успех не показывается, пока сервер не подтвердил', async () => {
    let release: (r: Response) => void = () => {};
    g.fetch = (() => new Promise<Response>((res) => { release = res; })) as unknown as typeof fetch;
    const id = add();
    rtl.render(<PipReminderConfirm />);
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Поставить')); });
    expect(q().queryByText(/Напоминание сохранено/)).toBeNull();
    expect(usePetStore.getState().chatHistory.find((m) => m.id === id)?.reminderProposal?.state).toBeUndefined();
    await rtl.act(async () => {
      release({ ok: true, status: 200, json: async () => ({ ok: true, action: 'remind', note: { id: 80, text: 'x', version: 2, updatedAt: '2026-10-14T01:00:00+00:00', reminder: null }, changed: true }) } as Response);
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(q().getByText(/Напоминание сохранено/)).toBeTruthy();
  });

  for (const type of ['cat', 'dog', 'bird', 'fox', 'dragon', 'bunny', 'panda', 'owl'] as const) test(`питомец ${type}: два предложения подряд сохраняются без 409`, async () => {
    usePetStore.setState({ type } as never);
    add({ reminderProposal: { ...proposal, noteId: 10, when: 'раз' } });
    rtl.render(<PipReminderConfirm />);
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Поставить')); });
    await wait();
    add({ reminderProposal: { ...proposal, noteId: 11, when: 'два' } });
    await wait();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Поставить')); });
    await wait();
    const sent = bodies.filter((b) => b.notesApi === 'remind');
    expect(sent.map((b) => b.id)).toEqual([10, 11]);
    expect(sent[0].requestId).not.toBe(sent[1].requestId);
    expect(q().queryByRole('alert')).toBeNull();
    expect(usePetStore.getState().chatHistory.every((m) => m.reminderProposal?.state === 'saved')).toBe(true);
  });
});
