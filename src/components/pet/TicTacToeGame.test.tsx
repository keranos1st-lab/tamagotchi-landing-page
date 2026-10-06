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
const plays = () => usePetStore.getState().xpLog.counts['game:tictactoe'] ?? 0;
const counters = () => useAchievementStore.getState().counters as Record<string, number>;
const ach = () => JSON.stringify(useAchievementStore.getState());
const advance = async (ms: number) => {
  await rtl.act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

type View = ReturnType<typeof rtl.render>;
const cellEls = (v: View) => Array.from(v.container.querySelectorAll('.grid-cols-3 button')) as HTMLButtonElement[];
const tap = (v: View, i: number) => rtl.fireEvent.click(cellEls(v)[i]);
const marks = (v: View) => cellEls(v).filter((b) => b.querySelector('svg, img')).length;
const back = (v: View) => rtl.fireEvent.click(v.container.querySelector('button[title="Назад к играм"]')!);
const openTtt = () => {
  const v = rtl.render(<MiniGames />);
  rtl.fireEvent.click(v.getByText('Крестики-нолики'));
  return v;
};
const playMoves = async (v: View, moves: number[]) => {
  for (const m of moves) {
    tap(v, m);
    await advance(500);
  }
};
const LOSS = [0, 1, 3];
const DRAW = [0, 1, 6, 5, 8];
const WIN = [0, 5, 7, 6, 3];

let randomSpy: ReturnType<typeof jest.spyOn>;
beforeEach(() => {
  jest.useFakeTimers();
  rtl.cleanup();
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
  setEnergy(80);
  useAchievementStore.setState({ counters: {}, unlocked: {}, gamesPlayed: [], queue: [] } as never);
});
afterAll(() => randomSpy?.mockRestore());

describe('Крестики-нолики: ход питомца', () => {
  test('питомец отвечает ровно через 500 мс, не раньше', async () => {
    const v = openTtt();
    tap(v, 0);
    expect(marks(v)).toBe(1);
    await advance(499);
    expect(marks(v)).toBe(1);
    await advance(1);
    expect(marks(v)).toBe(2);
  });

  test('алгоритм: центр, затем блокировка и выигрыш сохранены', async () => {
    const v = openTtt();
    tap(v, 0);
    await advance(500);
    expect(cellEls(v)[4].querySelector('img, svg')).toBeTruthy();
    expect(cellEls(v)[4].querySelector('.pa-pop')).toBeNull();
    tap(v, 1);
    await advance(500);
    expect(cellEls(v)[2].disabled).toBe(true);
    expect(cellEls(v)[2].querySelector('img, svg')).toBeTruthy();
    expect(cellEls(v)[2].querySelector('.pa-pop')).toBeNull();
  });

  test('во время ожидания клетки заблокированы', async () => {
    const v = openTtt();
    tap(v, 0);
    expect(cellEls(v).every((b) => b.disabled)).toBe(true);
    await advance(500);
    expect(cellEls(v)[1].disabled).toBe(false);
  });
});

describe('Крестики-нолики: выход и таймеры', () => {
  test('выход во время ожидания питомца: позднего хода, награды и списания энергии нет', async () => {
    const v = openTtt();
    tap(v, 0);
    const a = ach();
    back(v);
    await advance(30000);
    expect(energy()).toBe(80);
    expect(exp()).toBe(0);
    expect(plays()).toBe(0);
    expect(ach()).toBe(a);
    expect(counters().games).toBeUndefined();
  });

  test('выход во время ожидания перед проигрышем: поражение не засчитывается', async () => {
    const v = openTtt();
    await playMoves(v, [0, 1]);
    tap(v, 3);
    back(v);
    await advance(30000);
    expect(energy()).toBe(80);
    expect(plays()).toBe(0);
    expect(counters().games).toBeUndefined();
  });

  test('выход за один ход до ничьей: ничья не засчитывается', async () => {
    const v = openTtt();
    await playMoves(v, DRAW.slice(0, 4));
    expect(energy()).toBe(80);
    back(v);
    await advance(30000);
    expect(energy()).toBe(80);
    expect(plays()).toBe(0);
    expect(counters().games).toBeUndefined();
  });

  test('таймер хода питомца отменяется при выходе и при размонтировании', async () => {
    const v = openTtt();
    tap(v, 0);
    const before = jest.getTimerCount();
    back(v);
    expect(jest.getTimerCount()).toBeLessThan(before);
    rtl.cleanup();
    const v2 = openTtt();
    tap(v2, 0);
    const before2 = jest.getTimerCount();
    v2.unmount();
    expect(jest.getTimerCount()).toBeLessThan(before2);
    await advance(30000);
    expect(energy()).toBe(80);
  });

  test('выход и новая партия: старый таймер не влияет на неё', async () => {
    const v = openTtt();
    tap(v, 0);
    await advance(300);
    back(v);
    rtl.fireEvent.click(v.getByText('Крестики-нолики'));
    expect(marks(v)).toBe(0);
    tap(v, 8);
    await advance(200);
    expect(marks(v)).toBe(1);
    await advance(300);
    expect(marks(v)).toBe(2);
    await advance(30000);
    expect(marks(v)).toBe(2);
    expect(energy()).toBe(80);
    expect(plays()).toBe(0);
  });

  test('выход, новая партия и полная игра: итог один, без влияния старой', async () => {
    const v = openTtt();
    tap(v, 0);
    back(v);
    rtl.fireEvent.click(v.getByText('Крестики-нолики'));
    await playMoves(v, LOSS);
    await advance(30000);
    expect(plays()).toBe(1);
    expect(energy()).toBe(72);
    expect(counters().games).toBe(1);
  });
});

describe('Крестики-нолики: быстрые нажатия', () => {
  test('повторные нажатия не создают несколько ходов или таймеров', async () => {
    const single = openTtt();
    tap(single, 0);
    const expected = jest.getTimerCount();
    single.unmount();
    rtl.cleanup();
    const v = openTtt();
    const btns = cellEls(v);
    rtl.act(() => {
      for (const i of [0, 1, 2, 3, 0, 5]) btns[i].click();
    });
    expect(marks(v)).toBe(1);
    expect(jest.getTimerCount()).toBe(expected);
    await advance(500);
    expect(marks(v)).toBe(2);
    await advance(30000);
    expect(marks(v)).toBe(2);
  });

  test('нажатия без перерисовки между ними (одно событие) дают один ход', async () => {
    const v = openTtt();
    const btns = cellEls(v);
    for (const i of [0, 1, 2]) rtl.fireEvent.click(btns[i]);
    await advance(500);
    expect(marks(v)).toBe(2);
  });

  test('нажатия во время ожидания игнорируются, потом ход снова доступен', async () => {
    const v = openTtt();
    tap(v, 0);
    for (const i of [1, 2, 3]) tap(v, i);
    await advance(500);
    expect(marks(v)).toBe(2);
    tap(v, 1);
    expect(marks(v)).toBe(3);
  });

  test('нажатие на занятую клетку игнорируется', async () => {
    const v = openTtt();
    tap(v, 0);
    await advance(500);
    tap(v, 4);
    tap(v, 0);
    expect(marks(v)).toBe(2);
  });
});

describe('Крестики-нолики: завершение партии', () => {
  test('победа: итоги, 20 опыта, энергия -8, один раз', async () => {
    const v = openTtt();
    await playMoves(v, WIN);
    expect(v.getByText('Победа!')).toBeTruthy();
    expect(v.getByText('+20 опыта')).toBeTruthy();
    expect(exp()).toBe(20);
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(counters().games).toBe(1);
    expect(counters().gameWins).toBe(1);
    expect(counters().tttWins).toBe(1);
    const a = ach();
    for (let i = 0; i < 9; i++) tap(v, i);
    await advance(30000);
    expect(exp()).toBe(20);
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(ach()).toBe(a);
  });

  test('поражение: итоги, 2 опыта, энергия -8, один раз, победы не растут', async () => {
    const v = openTtt();
    await playMoves(v, LOSS);
    expect(v.getByText('Поражение')).toBeTruthy();
    expect(v.getByText(/Питомец победил/)).toBeTruthy();
    expect(exp()).toBe(2);
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(counters().games).toBe(1);
    expect(counters().gameWins).toBeUndefined();
    expect(counters().tttWins).toBeUndefined();
    const a = ach();
    for (let i = 0; i < 9; i++) tap(v, i);
    await advance(30000);
    expect(exp()).toBe(2);
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(ach()).toBe(a);
  });

  test('ничья: итоги, 10 опыта, энергия -8, один раз', async () => {
    const v = openTtt();
    await playMoves(v, DRAW);
    expect(v.getByText('Ничья')).toBeTruthy();
    expect(v.getByText('+10 опыта')).toBeTruthy();
    expect(exp()).toBe(10);
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(counters().games).toBe(1);
    expect(counters().gameWins).toBeUndefined();
    await advance(30000);
    expect(exp()).toBe(10);
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
  });

  test('после завершения поле заблокировано', async () => {
    const v = openTtt();
    await playMoves(v, LOSS);
    expect(cellEls(v).every((b) => b.disabled)).toBe(true);
    const before = marks(v);
    for (let i = 0; i < 9; i++) tap(v, i);
    expect(marks(v)).toBe(before);
  });

  test('«Готово» возвращает к списку игр', async () => {
    const v = openTtt();
    await playMoves(v, LOSS);
    rtl.fireEvent.click(v.getByText('Готово'));
    expect(v.getByText('Реакция')).toBeTruthy();
    expect(v.queryByText('Поражение')).toBeNull();
  });

  test('низкая энергия: итоги остаются видны', async () => {
    setEnergy(12);
    const v = openTtt();
    await playMoves(v, LOSS);
    expect(energy()).toBe(4);
    expect(v.getByText('Поражение')).toBeTruthy();
    expect(v.getByText('Готово')).toBeTruthy();
    expect(v.queryByText('Нет сил играть')).toBeNull();
    await advance(30000);
    expect(v.getByText('Поражение')).toBeTruthy();
    rtl.fireEvent.click(v.getByText('Готово'));
    expect(v.getByText('Нет сил играть')).toBeTruthy();
  });

  test('низкая энергия: победа с итогами и наградой', async () => {
    setEnergy(10);
    const v = openTtt();
    await playMoves(v, WIN);
    expect(energy()).toBe(2);
    expect(v.getByText('Победа!')).toBeTruthy();
    expect(exp()).toBe(20);
  });

  test('при энергии ниже 10 игра не запускается', () => {
    setEnergy(9);
    const v = rtl.render(<MiniGames />);
    expect(v.getByText('Нет сил играть')).toBeTruthy();
    expect(v.queryByText('Крестики-нолики')).toBeNull();
  });
});
