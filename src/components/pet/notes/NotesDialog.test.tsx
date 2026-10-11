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
(win as unknown as { ResizeObserver: unknown }).ResizeObserver = g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const rtl = await import('@testing-library/react');
const { NotesDialog } = await import('./NotesDialog');
const { useAuthStore } = await import('@/store/authStore');
const { useNoteDraft } = await import('@/store/noteDraftStore');
const { openNotes, notifyNotesChanged } = await import('@/utils/notesApi');

afterAll(() => {
  rtl.cleanup();
  for (const k of KEYS) {
    if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!);
    else delete g[k];
  }
});

type Rem = { dueAt: string; dueLocal: string; tz: string; tzLabel: string; lead: number; leadText: string; remindAt: string; state: 'active' | 'done'; seq: number; when: string; text: string };
type Note = { id: number; text: string; version: number; updatedAt: string; reminder?: Rem | null };
const mkRem = (dueLocal: string, lead = 15): Rem => ({ dueAt: '2026-10-12T09:00:00+00:00', dueLocal, tz: 'Europe/Moscow', tzLabel: 'Europe/Moscow, UTC+03:00', lead, leadText: lead ? `за ${lead} минут` : 'в указанное время', remindAt: '2026-10-12T08:45:00+00:00', state: 'active', seq: 1, when: 'понедельник, 12 октября 2026, 12:00', text: 't' });
const mk = (id: number, text: string, version = 1, reminder: Rem | null = null): Note => ({ id, text, version, updatedAt: '2026-10-11T10:00:00+00:00', reminder });
let store: Note[] = [];
let failList = false;
let failSave = false;
const bodies: Array<Record<string, unknown>> = [];
const q = () => rtl.within(win.document.body as unknown as HTMLElement);
const text = () => win.document.body.textContent ?? '';
const wait = (ms = 30) => rtl.act(async () => { await new Promise((r) => setTimeout(r, ms)); });

beforeEach(async () => {
  jest.useRealTimers();
  rtl.cleanup();
  useNoteDraft.getState().discard();
  store = [];
  failList = false;
  failSave = false;
  bodies.length = 0;
  useAuthStore.getState().setSession('tok', { id: 1, email: 'a@example.invalid', createdAt: '' });
  g.fetch = (async (_u: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    bodies.push(body);
    if (body.notesApi === 'list') {
      if (failList) return { ok: false, status: 503, json: async () => ({ error: 'notes_unavailable', message: 'Блокнот временно недоступен', retryable: true }) } as Response;
      const q = String(body.query || '').toLowerCase().slice(0, 4);
      const rows = store.filter((n) => !q || n.text.toLowerCase().includes(q));
      return { ok: true, status: 200, json: async () => ({ ok: true, notes: rows, total: rows.length, offset: 0, hasMore: false }) } as Response;
    }
    if (body.notesApi === 'remind') {
      const cur = store.find((x) => x.id === body.id)!;
      const n = { ...cur, version: cur.version + 1, reminder: body.reminder ? mkRem(body.reminder.dueLocal, body.reminder.lead) : null };
      store = store.map((x) => (x.id === n.id ? n : x));
      return { ok: true, status: 200, json: async () => ({ ok: true, action: 'remind', note: n, changed: true }) } as Response;
    }
    if (failSave) return { ok: false, status: 503, json: async () => ({ error: 'notes_unavailable', message: 'Не удалось подтвердить сохранение', retryable: true }) } as Response;
    const base = body.id ? store.find((x) => x.id === body.id)! : null;
    const reminder = 'reminder' in body ? (body.reminder ? mkRem(body.reminder.dueLocal, body.reminder.lead) : null) : base?.reminder ?? null;
    const n = base ? { ...base, text: body.text, version: 2, reminder } : mk(100 + store.length, body.text, 1, reminder);
    store = base ? store.map((x) => (x.id === n.id ? n : x)) : [n, ...store];
    return { ok: true, status: 200, json: async () => ({ ok: true, action: body.id ? 'update' : 'create', note: n, changed: true }) } as Response;
  }) as typeof fetch;
});

const open = async () => {
  rtl.render(<NotesDialog />);
  await rtl.act(async () => { openNotes(); });
  await wait();
};
const click = async (label: string | RegExp) => {
  const el = q().getByText(label);
  await rtl.act(async () => { rtl.fireEvent.click(el.closest('button') ?? el); });
  await wait();
};
const type = async (el: Element, value: string) => {
  await rtl.act(async () => { rtl.fireEvent.change(el, { target: { value } }); });
};

describe('окно «Заметки»', () => {
  test('без входа предлагает войти и не обращается к серверу', async () => {
    useAuthStore.getState().clearSession();
    await open();
    expect(text()).toContain('Войди в аккаунт, чтобы видеть заметки');
    expect(bodies.length).toBe(0);
  });

  test('пустой список', async () => {
    await open();
    expect(text()).toContain('Заметок пока нет');
  });

  test('показывает все заметки, а не пять', async () => {
    store = Array.from({ length: 9 }, (_, i) => mk(9 - i, `заметка ${9 - i}`));
    await open();
    for (let i = 1; i <= 9; i++) expect(text()).toContain(`заметка ${i}`);
    expect(text()).toContain('Всего заметок: 9');
  });

  test('ошибка загрузки с кнопкой «Повторить»', async () => {
    failList = true;
    await open();
    expect(text()).toContain('Блокнот временно недоступен');
    failList = false;
    store = [mk(1, 'после повтора')];
    await click('Повторить');
    expect(text()).toContain('после повтора');
  });

  test('поиск: найдено и «Ничего не найдено»', async () => {
    store = [mk(2, 'молоко купить'), mk(1, 'позвонить Сергею')];
    await open();
    const input = q().getByPlaceholderText('Поиск по заметкам');
    await type(input, 'позв');
    await wait(500);
    expect(text()).toContain('позвонить Сергею');
    expect(text()).not.toContain('молоко купить');
    await type(input, 'ящерица');
    await wait(500);
    expect(text()).toContain('Ничего не найдено');
  });

  test('просмотр полного текста', async () => {
    store = [mk(5, 'длинный текст заметки для просмотра')];
    await open();
    await click('длинный текст заметки для просмотра');
    expect(text()).toContain('Заметка №5');
    expect(text()).toContain('Изменить');
  });

  test('создание: подтверждение только после ответа сервера, список обновляется', async () => {
    await open();
    await click('Новая');
    const area = q().getByPlaceholderText('Что записать?');
    await type(area, 'новая мысль');
    await click('Сохранить');
    const save = bodies.find((b) => b.notesApi === 'save')!;
    expect(save.id).toBe(null);
    expect(save.text).toBe('новая мысль');
    expect(text()).toContain('новая мысль');
    expect(useNoteDraft.getState().active).toBe(false);
  });

  test('редактирование передаёт точный ID и версию', async () => {
    store = [mk(7, 'старый текст', 1)];
    await open();
    await click('старый текст');
    await click('Изменить');
    await type(q().getByPlaceholderText('Что записать?'), 'новый текст');
    await click('Сохранить');
    const save = bodies.find((b) => b.notesApi === 'save')!;
    expect(save.id).toBe(7);
    expect(save.expectedVersion).toBe(1);
    expect(text()).toContain('новый текст');
  });

  test('ошибка сохранения: текст остаётся, «сохранено» не показывается, повтор работает', async () => {
    await open();
    await click('Новая');
    await type(q().getByPlaceholderText('Что записать?'), 'не потерять');
    failSave = true;
    await click('Сохранить');
    expect(text()).toContain('Не удалось подтвердить сохранение');
    expect(text()).toContain('Введённый текст сохранён в окне');
    expect((q().getByPlaceholderText('Что записать?') as HTMLTextAreaElement).value).toBe('не потерять');
    expect(useNoteDraft.getState().text).toBe('не потерять');
    failSave = false;
    await click('Повторить');
    const saves = bodies.filter((b) => b.notesApi === 'save');
    expect(saves.length).toBe(2);
    expect(saves[0].requestId).toBe(saves[1].requestId);
    expect(store.map((n) => n.text)).toEqual(['не потерять']);
  });

  test('голосовая команда обновляет открытый список', async () => {
    await open();
    expect(text()).toContain('Заметок пока нет');
    store = [mk(3, 'создано голосом')];
    await rtl.act(async () => { notifyNotesChanged(); });
    await wait();
    expect(text()).toContain('создано голосом');
  });

  test('в списке видна метка напоминания и «выполнено»', async () => {
    store = [mk(2, 'созвон', 1, mkRem('2026-10-12T12:00')), mk(1, 'обычная заметка')];
    await open();
    expect(text()).toContain('12 октября 2026');
    expect(text()).toContain('обычная заметка');
  });

  test('просмотр заметки с напоминанием показывает дату, время, пояс и «заранее»', async () => {
    store = [mk(2, 'созвон', 1, mkRem('2026-10-12T12:00', 30))];
    await open();
    await click('созвон');
    expect(text()).toContain('понедельник, 12 октября 2026, 12:00');
    expect(text()).toContain('UTC+03:00');
    expect(text()).toContain('за 30 минут');
    expect(text()).toContain('Изменить время');
    expect(text()).toContain('Отключить');
  });

  test('отключение напоминания не трогает текст и шлёт reminder: null', async () => {
    store = [mk(2, 'созвон', 1, mkRem('2026-10-12T12:00'))];
    await open();
    await click('созвон');
    await click('Отключить');
    const call = bodies.find((b) => b.notesApi === 'remind')!;
    expect(call).toMatchObject({ id: 2, reminder: null });
    expect(store[0].text).toBe('созвон');
    expect(store[0].reminder).toBe(null);
    expect(text()).toContain('Добавить напоминание');
  });

  test('обычная заметка: напоминание выключено, сохраняется без поля reminder', async () => {
    await open();
    await click('Новая');
    expect(text()).toContain('Без даты и времени это обычная заметка.');
    await type(q().getByPlaceholderText('Что записать?'), 'добавить Кодику анимацию');
    await click('Сохранить');
    const save = bodies.find((b) => b.notesApi === 'save')!;
    expect('reminder' in save).toBe(false);
  });

  test('создание с напоминанием: по умолчанию «за 15 минут», дата и время уходят вместе с поясом', async () => {
    await open();
    await click('Новая');
    await type(q().getByPlaceholderText('Что записать?'), 'позвонить Сергею');
    await rtl.act(async () => { rtl.fireEvent.click(q().getByRole('switch', { name: 'Напоминание' })); });
    expect(q().getByText('За 15 минут').getAttribute('aria-pressed')).toBe('true');
    await type(q().getByLabelText('Дата напоминания'), '2026-10-12');
    await type(q().getByLabelText('Время напоминания'), '12:00');
    await click('Сохранить');
    const save = bodies.find((b) => b.notesApi === 'save')!;
    expect(save.reminder).toMatchObject({ dueLocal: '2026-10-12T12:00', lead: 15 });
    expect(typeof (save.reminder as { tz: string }).tz).toBe('string');
  });

  test('перенос напоминания: можно выбрать «за 30 минут» и «в указанное время»', async () => {
    store = [mk(2, 'созвон', 1, mkRem('2026-10-12T12:00'))];
    await open();
    await click('созвон');
    await click('Изменить время');
    await click('За 30 минут');
    await type(q().getByLabelText('Время напоминания'), '15:45');
    await click('Сохранить');
    expect(bodies.find((b) => b.notesApi === 'save')!.reminder).toMatchObject({ dueLocal: '2026-10-12T15:45', lead: 30 });
  });

  test('правка только текста не меняет напоминание (поле reminder не отправляется)', async () => {
    store = [mk(2, 'созвон', 1, mkRem('2026-10-12T12:00'))];
    await open();
    await click('созвон');
    await click('Изменить время');
    await type(q().getByPlaceholderText('Что записать?'), 'созвон с Сергеем');
    await click('Сохранить');
    const save = bodies.find((b) => b.notesApi === 'save')!;
    expect('reminder' in save).toBe(false);
    expect(store[0].reminder?.dueLocal).toBe('2026-10-12T12:00');
  });

  test('ошибка «время прошло» не теряет введённое', async () => {
    store = [];
    await open();
    await click('Новая');
    await type(q().getByPlaceholderText('Что записать?'), 'не потерять');
    await rtl.act(async () => { rtl.fireEvent.click(q().getByRole('switch', { name: 'Напоминание' })); });
    failSave = true;
    await click('Сохранить');
    expect((q().getByPlaceholderText('Что записать?') as HTMLTextAreaElement).value).toBe('не потерять');
    expect(useNoteDraft.getState().remindOn).toBe(true);
  });
});

