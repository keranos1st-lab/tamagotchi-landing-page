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
const { usePetStore } = await import('@/store/petStore');
const { useAchievementStore } = await import('@/store/achievementStore');
const { useAchievementWatcher } = await import('./achievements/useAchievements');
const { ACHIEVEMENTS, progressOf, CURRENT_GAMES } = await import('./achievements/catalog');

afterAll(() => {
  rtl.cleanup();
  for (const k of KEYS) {
    if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!);
    else delete g[k];
  }
});

const advance = async (ms: number) => {
  await rtl.act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
function Watcher() {
  useAchievementWatcher();
  return null;
}
const A = () => useAchievementStore.getState();
const all = () => ACHIEVEMENTS.find((x) => x.id === 'all_games')!;
const progressWith = (played: string[]) =>
  all().value({ pet: usePetStore.getState(), c: {}, gamesPlayed: played, petsOwned: [], days: [] } as never);
const ctxWith = (played: string[]) => ({ pet: usePetStore.getState(), c: {}, gamesPlayed: played, petsOwned: [], days: [] }) as never;
const rewards = () => A().queue.filter((x) => x === 'all_games').length;
let gains: number[] = [];
let origGain: ((n: number) => void) | null = null;
const reset = (extra: object = {}) => {
  useAchievementStore.setState({ counters: {}, unlocked: {}, gamesPlayed: [], queue: [], days: [], petsOwned: [], ...extra } as never);
};
const SEVEN = ['chase', 'tetris', 'memory', 'quiz', 'snake', 'tictactoe', 'reaction'];

beforeEach(() => {
  jest.useFakeTimers();
  rtl.cleanup();
  usePetStore.setState({ hasSelectedPet: true, type: 'cat', name: 'Тест', exp: 0, level: 1 } as never);
  if (origGain) usePetStore.setState({ gainExp: origGain } as never);
  origGain = usePetStore.getState().gainExp;
  gains = [];
  const orig = origGain;
  usePetStore.setState({ gainExp: (n: number) => { gains.push(n); orig(n); } } as never);
  reset();
});

describe('Достижение «Всё перепробовал» (all_games)', () => {
  test('id, название, награда и редкость сохранены', () => {
    const a = all();
    expect(a.id).toBe('all_games');
    expect(a.title).toBe('Всё перепробовал');
    expect(a.xp).toBe(60);
    expect(a.rarity).toBe('rare');
    expect(a.goal).toBe(7);
    expect(ACHIEVEMENTS.filter((x) => x.id === 'all_games').length).toBe(1);
  });

  test('список текущих игр: ровно семь ожидаемых', () => {
    expect([...CURRENT_GAMES].sort()).toEqual([...SEVEN].sort());
  });

  test('шесть текущих игр плюс catch — прогресс 6, достижение не открывается', async () => {
    const six = SEVEN.filter((g) => g !== 'tetris');
    reset({ gamesPlayed: [...six, 'catch'] });
    expect(A().gamesPlayed.length).toBe(7);
    expect(progressWith(A().gamesPlayed)).toBe(6);
    expect(progressOf(all(), ctxWith(A().gamesPlayed))).toBeCloseTo(6 / 7);
    const v = rtl.render(<Watcher />);
    await advance(0);
    expect(A().unlocked.all_games).toBeUndefined();
    expect(rewards()).toBe(0);
    v.unmount();
  });

  test('все семь текущих игр — достижение открывается один раз с наградой 60', async () => {
    reset({ gamesPlayed: [...SEVEN] });
    expect(progressWith(SEVEN)).toBe(7);
    const v = rtl.render(<Watcher />);
    await advance(0);
    const stamp = A().unlocked.all_games;
    expect(stamp).toBeGreaterThan(0);
    expect(rewards()).toBe(1);
    expect(rewards()).toBe(1);
    v.rerender(<Watcher />);
    await advance(5000);
    expect(A().unlocked.all_games).toBe(stamp);
    expect(rewards()).toBe(1);
    expect(rewards()).toBe(1);
    v.unmount();
  });

  test('семь игр вместе со старым catch тоже открывают достижение один раз', async () => {
    reset({ gamesPlayed: ['catch', ...SEVEN] });
    expect(progressWith(A().gamesPlayed)).toBe(7);
    const v = rtl.render(<Watcher />);
    await advance(0);
    expect(rewards()).toBe(1);
    v.unmount();
  });

  test('дубликаты не увеличивают прогресс', () => {
    expect(progressWith(['chase', 'chase', 'chase', 'tetris', 'tetris'])).toBe(2);
    expect(progressWith([...SEVEN, ...SEVEN, ...SEVEN])).toBe(7);
  });

  test('неизвестные значения и catch не увеличивают прогресс', () => {
    expect(progressWith(['catch'])).toBe(0);
    expect(progressWith(['catch', 'foo', '', 'Tetris', 'CHASE', ' chase', 'chase '])).toBe(0);
    expect(progressWith(['quiz', 'unknown', 'catch', 'x1', 'x2', 'x3', 'x4', 'x5'])).toBe(1);
  });

  test('семь неизвестных значений не открывают достижение', async () => {
    reset({ gamesPlayed: ['catch', 'a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    const v = rtl.render(<Watcher />);
    await advance(0);
    expect(progressWith(A().gamesPlayed)).toBe(0);
    expect(A().unlocked.all_games).toBeUndefined();
    expect(rewards()).toBe(0);
    v.unmount();
  });

  test('пустой список и один тетрис', () => {
    expect(progressWith([])).toBe(0);
    expect(progressWith(['tetris'])).toBe(1);
  });

  test('старое открытое all_games сохраняется с прежней датой, без новой награды', async () => {
    const stamp = 1700000000000;
    reset({ unlocked: { all_games: stamp }, gamesPlayed: ['catch', 'chase', 'memory', 'quiz', 'snake', 'tictactoe', 'reaction'] });
    expect(progressWith(A().gamesPlayed)).toBe(6);
    const v = rtl.render(<Watcher />);
    await advance(0);
    expect(A().unlocked.all_games).toBe(stamp);
    expect(rewards()).toBe(0);
    expect(rewards()).toBe(0);
    A().markGame('tetris');
    await advance(0);
    expect(A().unlocked.all_games).toBe(stamp);
    expect(rewards()).toBe(0);
    expect(rewards()).toBe(0);
    v.unmount();
  });

  test('после проверки сохранённый gamesPlayed не очищается: старые отметки и порядок остаются', async () => {
    const saved = ['catch', 'chase', 'foo', 'chase', 'memory'];
    reset({ gamesPlayed: [...saved] });
    const v = rtl.render(<Watcher />);
    await advance(0);
    expect(A().gamesPlayed).toEqual(saved);
    A().markGame('quiz');
    await advance(0);
    expect(A().gamesPlayed).toEqual([...saved, 'quiz']);
    const toSave = useAchievementStore.persist.getOptions().partialize!(A()) as { gamesPlayed: string[] };
    expect(toSave.gamesPlayed).toEqual([...saved, 'quiz']);
    expect(toSave.gamesPlayed).toContain('catch');
    v.unmount();
  });

  test('отметка catch не добавляется заново, а новые игры отмечаются как раньше', () => {
    reset({ gamesPlayed: ['catch'] });
    A().markGame('tetris');
    A().markGame('tetris');
    expect(A().gamesPlayed).toEqual(['catch', 'tetris']);
    expect(progressWith(A().gamesPlayed)).toBe(1);
  });

  test('другие достижения этой категории не затронуты', () => {
    const x = ctxWith(['catch', 'chase']);
    const gamer = ACHIEVEMENTS.find((a) => a.id === 'gamer')!;
    expect(gamer.goal).toBe(10);
    expect(gamer.xp).toBe(20);
    expect(ACHIEVEMENTS.find((a) => a.id === 'catcher')!.title).toBe('Мастер линий');
    expect(progressOf(gamer, x)).toBe(0);
  });

  test('полный путь: игры отмечаются по одной, достижение открывается только на седьмой текущей', async () => {
    reset({ gamesPlayed: ['catch'] });
    const v = rtl.render(<Watcher />);
    for (let i = 0; i < SEVEN.length; i++) {
      A().markGame(SEVEN[i]);
      await advance(0);
      if (i < 6) expect(A().unlocked.all_games).toBeUndefined();
    }
    expect(A().unlocked.all_games).toBeGreaterThan(0);
    expect(rewards()).toBe(1);
    expect(A().gamesPlayed.length).toBe(8);
    v.unmount();
  });
});
