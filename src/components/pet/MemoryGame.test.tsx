// @ts-expect-error bun:test доступен только при запуске через bun
import { afterAll, beforeEach, describe, expect, jest, test } from 'bun:test';
import { Window } from 'happy-dom';

const g = globalThis as unknown as Record<string, unknown>;
const saved: Record<string, PropertyDescriptor | undefined> = {};
const KEYS = ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'Node', 'Element', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];

const win = new Window({ url: 'http://localhost/' });
for (const k of KEYS) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
const w = win as unknown as Record<string, unknown>;
for (const k of KEYS) {
  if (k === 'window') g.window = win;
  else if (k === 'IS_REACT_ACT_ENVIRONMENT') g[k] = true;
  else if (k === 'requestAnimationFrame') g[k] = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16);
  else if (k === 'cancelAnimationFrame') g[k] = (id: number) => clearTimeout(id);
  else Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: k === 'getComputedStyle' ? (w[k] as () => unknown).bind(win) : w[k] });
}

const rtl = await import('@testing-library/react');
const { MiniGames } = await import('./MiniGames');
const { usePetStore } = await import('@/store/petStore');
const { useAchievementStore } = await import('@/store/achievementStore');

afterAll(() => {
  rtl.cleanup();
  for (const k of KEYS) {
    if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!);
    else delete g[k];
  }
});

const setEnergy = (energy: number) => usePetStore.setState({ energy, hasSelectedPet: true, type: 'cat', name: 'Тест', exp: 0, level: 1, xpLog: { day: '', counts: {} } } as never);
const energy = () => usePetStore.getState().energy;
const exp = () => usePetStore.getState().exp;
const plays = () => usePetStore.getState().xpLog.counts['game:memory'] ?? 0;
const counters = () => useAchievementStore.getState().counters as Record<string, number>;
const ach = () => JSON.stringify(useAchievementStore.getState());
const advance = async (ms: number) => {
  await rtl.act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

type View = ReturnType<typeof rtl.render>;
const cardEls = (v: View) => Array.from(v.container.querySelectorAll('.grid button')) as HTMLButtonElement[];
const open = (v: View, i: number) => {
  const el = cardEls(v)[i];
  if (el) rtl.fireEvent.click(el);
};
const shown = (v: View) => cardEls(v).map((b) => !!b.querySelector('img'));
const shownCount = (v: View) => shown(v).filter(Boolean).length;
const moves = (v: View) => v.container.querySelector('.tabular-nums')?.textContent;
const back = (v: View) => rtl.fireEvent.click(v.container.querySelector('button[title="Назад к играм"]')!);
const openMemory = () => {
  const v = rtl.render(<MiniGames />);
  rtl.fireEvent.click(v.getByText('Мемори'));
  return v;
};
const matchPair = async (v: View, k: number) => {
  open(v, k);
  open(v, k + 8);
  await advance(500);
};
const missPair = async (v: View, a = 0, b = 1) => {
  open(v, a);
  open(v, b);
  await advance(1000);
};
const playToLastPair = async (v: View) => {
  for (let k = 0; k < 7; k++) await matchPair(v, k);
};

let randomSpy: ReturnType<typeof jest.spyOn>;
beforeEach(() => {
  jest.useFakeTimers();
  rtl.cleanup();
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  setEnergy(80);
  useAchievementStore.setState({ counters: {}, unlocked: {}, games: {} } as never);
});
afterAll(() => randomSpy?.mockRestore());

describe('Мемори: отложенные действия', () => {
  test('16 карточек, пары лежат как ожидается', () => {
    const v = openMemory();
    expect(cardEls(v).length).toBe(16);
    expect(shownCount(v)).toBe(0);
  });

  test('обычная победа: итоги появляются, награда и энергия учтены один раз', async () => {
    const v = openMemory();
    await playToLastPair(v);
    open(v, 7);
    open(v, 15);
    await advance(499);
    expect(v.queryByText('Готово')).toBeNull();
    expect(energy()).toBe(80);
    await advance(1);
    expect(v.getByText('Все пары найдены!')).toBeTruthy();
    expect(v.getByText('За 8 ходов')).toBeTruthy();
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(exp()).toBe(50);
    const a = ach();
    await advance(30000);
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(exp()).toBe(50);
    expect(ach()).toBe(a);
    expect(counters().games).toBe(1);
    expect(counters().gameWins).toBe(1);
  });

  test('формула награды сохранена: каждый лишний ход после 8-го отнимает 2 опыта', async () => {
    const v = openMemory();
    await missPair(v);
    await missPair(v);
    await missPair(v);
    for (let k = 0; k < 8; k++) await matchPair(v, k);
    expect(v.getByText('За 11 ходов')).toBeTruthy();
    expect(exp()).toBe(44);
  });

  test('несовпавшая пара закрывается через 1000 мс, не раньше', async () => {
    const v = openMemory();
    open(v, 0);
    open(v, 1);
    expect(shownCount(v)).toBe(2);
    await advance(999);
    expect(shownCount(v)).toBe(2);
    await advance(1);
    expect(shownCount(v)).toBe(0);
  });

  test('совпавшая пара остаётся открытой после 500 мс', async () => {
    const v = openMemory();
    await matchPair(v, 3);
    expect(shown(v)[3]).toBe(true);
    expect(shown(v)[11]).toBe(true);
    expect(shownCount(v)).toBe(2);
  });

  test('выход во время обработки совпавшей пары: старый таймер не влияет на новую игру', async () => {
    const v = openMemory();
    open(v, 0);
    open(v, 8);
    await advance(200);
    back(v);
    rtl.fireEvent.click(v.getByText('Мемори'));
    open(v, 5);
    await advance(5000);
    expect(shown(v)[5]).toBe(true);
    expect(shown(v)[0]).toBe(false);
    expect(shown(v)[8]).toBe(false);
    expect(shownCount(v)).toBe(1);
    expect(moves(v)).toBe('0');
    expect(energy()).toBe(80);
  });

  test('выход во время обработки несовпавшей пары: старый таймер не влияет на новую игру', async () => {
    const v = openMemory();
    open(v, 0);
    open(v, 1);
    await advance(400);
    back(v);
    rtl.fireEvent.click(v.getByText('Мемори'));
    open(v, 4);
    await advance(5000);
    expect(shown(v)[4]).toBe(true);
    expect(shownCount(v)).toBe(1);
    expect(moves(v)).toBe('0');
    open(v, 6);
    expect(shownCount(v)).toBe(2);
  });

  test('выход после выбора последней пары до завершения задержки: поздней награды, энергии и достижений нет', async () => {
    const v = openMemory();
    await playToLastPair(v);
    const a = ach();
    open(v, 7);
    open(v, 15);
    await advance(300);
    back(v);
    await advance(30000);
    expect(energy()).toBe(80);
    expect(exp()).toBe(0);
    expect(plays()).toBe(0);
    expect(ach()).toBe(a);
    expect(counters().games).toBeUndefined();
    expect(counters().gameWins).toBeUndefined();
  });

  test('размонтирование без кнопки «назад» тоже отменяет таймеры', async () => {
    const v = openMemory();
    await playToLastPair(v);
    open(v, 7);
    open(v, 15);
    v.unmount();
    await advance(30000);
    expect(energy()).toBe(80);
    expect(plays()).toBe(0);
    expect(counters().games).toBeUndefined();
  });

  test('выход и новая игра: награда новой победы один раз, старая не добавляется', async () => {
    const v = openMemory();
    await playToLastPair(v);
    open(v, 7);
    open(v, 15);
    await advance(300);
    back(v);
    rtl.fireEvent.click(v.getByText('Мемори'));
    for (let k = 0; k < 8; k++) await matchPair(v, k);
    await advance(10000);
    expect(plays()).toBe(1);
    expect(energy()).toBe(72);
    expect(counters().games).toBe(1);
    expect(v.getByText('За 8 ходов')).toBeTruthy();
  });

  test('быстрые повторные нажатия не открывают третью карточку', async () => {
    const v = openMemory();
    open(v, 0);
    open(v, 1);
    open(v, 2);
    open(v, 3);
    open(v, 4);
    expect(shownCount(v)).toBe(2);
    expect(moves(v)).toBe('1');
    await advance(1000);
    expect(shownCount(v)).toBe(0);
    open(v, 2);
    expect(shownCount(v)).toBe(1);
  });

  test('быстрые повторные нажатия не создают лишних таймеров', async () => {
    const v = openMemory();
    open(v, 0);
    const base = jest.getTimerCount();
    open(v, 1);
    expect(jest.getTimerCount()).toBe(base + 1);
    for (const i of [2, 3, 1, 0, 4, 5]) open(v, i);
    expect(jest.getTimerCount()).toBe(base + 1);
  });

  test('повторные нажатия на последней паре не дублируют награду', async () => {
    const v = openMemory();
    await playToLastPair(v);
    open(v, 7);
    open(v, 15);
    for (const i of [7, 15, 7, 15, 3]) open(v, i);
    await advance(500);
    for (const i of [7, 15]) open(v, i);
    await advance(30000);
    expect(plays()).toBe(1);
    expect(energy()).toBe(72);
    expect(counters().games).toBe(1);
    expect(moves(v)).toBe('8');
  });

  test('одну и ту же карточку дважды нажать нельзя', async () => {
    const v = openMemory();
    open(v, 0);
    open(v, 0);
    expect(shownCount(v)).toBe(1);
    expect(moves(v)).toBe('0');
  });

  test('низкая энергия: итоги Мемори остаются видны', async () => {
    setEnergy(12);
    const v = openMemory();
    for (let k = 0; k < 8; k++) await matchPair(v, k);
    expect(energy()).toBe(4);
    expect(v.getByText('Готово')).toBeTruthy();
    expect(v.queryByText('Нет сил играть')).toBeNull();
  });
});
