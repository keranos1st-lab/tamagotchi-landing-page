// @ts-expect-error bun:test доступен только при запуске через bun
import { afterAll, beforeEach, describe, expect, jest, test } from 'bun:test';
import { Window } from 'happy-dom';
import type { TetrisState } from './tetrisLogic';

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
const L = await import('./tetrisLogic');
const { useAchievementWatcher } = await import('./achievements/useAchievements');
const { ACHIEVEMENTS, progressOf } = await import('./achievements/catalog');

afterAll(() => {
  rtl.cleanup();
  for (const k of KEYS) {
    if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!);
    else delete g[k];
  }
});

const setEnergy = (energy: number) => usePetStore.setState({ energy, hasSelectedPet: true, type: 'cat', name: 'Тест', exp: 0, level: 1, xpLog: { day: '', counts: {} } } as never);
const counters = () => useAchievementStore.getState().counters as Record<string, number>;
const advance = async (ms: number) => {
  await rtl.act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

type View = ReturnType<typeof rtl.render>;
const keyTarget = window as unknown as Document;
const key = (k: string) => rtl.fireEvent.keyDown(keyTarget, { key: k });
const stat = (v: View, name: string) => Number(v.getByTestId(`tetris-${name}`).textContent);
const back = (v: View) => rtl.fireEvent.click(v.container.querySelector('button[title="Назад к играм"]')!);
const evaluate = (board: number[][]) => {
  const heights = Array(10).fill(0);
  let holes = 0;
  for (let x = 0; x < 10; x++) {
    let seen = false;
    for (let y = 0; y < 20; y++) {
      if (board[y][x]) {
        if (!seen) heights[x] = 20 - y;
        seen = true;
      } else if (seen) holes++;
    }
  }
  let bump = 0;
  for (let x = 0; x < 9; x++) bump += Math.abs(heights[x] - heights[x + 1]);
  return -0.51 * heights.reduce((a, b) => a + b, 0) - 0.36 * holes - 0.18 * bump;
};

type Op = 'ArrowUp' | 'ArrowLeft' | 'ArrowRight' | ' ';
const plan = (sim: TetrisState): { ops: Op[]; result: TetrisState } | null => {
  let best: { ops: Op[]; result: TetrisState; score: number } | null = null;
  for (let rot = 0; rot < 4; rot++) {
    let s = sim;
    const ops: Op[] = [];
    let ok = true;
    for (let i = 0; i < rot; i++) {
      const r = L.rotateCW(s);
      if (r === s) ok = false;
      s = r;
      ops.push('ArrowUp');
    }
    if (!ok) continue;
    for (const dir of [-1, 1] as const) {
      let cur = s;
      const o = [...ops];
      for (let step = 0; step <= 10; step++) {
        const done = L.hardDrop(cur);
        if (!done.over) {
          const score = evaluate(done.board) + 0.76 * (done.lines - sim.lines) * 10;
          if (!best || score > best.score) best = { ops: [...o, ' '], result: done, score };
        }
        const moved = L.moveH(cur, dir);
        if (moved === cur) break;
        cur = moved;
        o.push(dir < 0 ? 'ArrowLeft' : 'ArrowRight');
      }
    }
  }
  return best;
};

let randomSpy: ReturnType<typeof jest.spyOn>;
afterAll(() => randomSpy?.mockRestore());

function Watcher() {
  useAchievementWatcher();
  return null;
}
const ach_ = () => useAchievementStore.getState();
const best = () => counters().tetrisLinesBest;
const catcher = () => ACHIEVEMENTS.find((x) => x.id === 'catcher')!;
const resetAch = (extra: object = {}) => useAchievementStore.setState({ counters: {}, unlocked: {}, gamesPlayed: [], queue: [], ...extra } as never);
const unlockedAt = () => ach_().unlocked.catcher;
let gains: number[] = [];
const bigGains = () => gains.filter((g) => g === 100).length;
const trackGains = () => {
  gains = [];
  const orig = usePetStore.getState().gainExp;
  usePetStore.setState({ gainExp: (n: number) => { gains.push(n); orig(n); } } as never);
  return orig;
};
let origGain: ((n: number) => void) | null = null;

const playExact = async (v: View, lines: number) => {
  let sim = L.newGame(() => 0.5);
  for (let i = 0; i < 300 && sim.lines < lines; i++) {
    const p = plan(sim);
    if (!p) break;
    if (sim.lines + p.result.lines - sim.lines > lines) break;
    for (const k of p.ops) key(k);
    sim = p.result;
  }
  expect(stat(v, 'Линии')).toBe(sim.lines);
  return sim.lines;
};
const finishSafely = async (v: View) => {
  for (let i = 0; i < 120 && !v.queryByText('Готово'); i++) {
    key('ArrowLeft');
    key('ArrowLeft');
    key('ArrowLeft');
    key('ArrowLeft');
    key('ArrowLeft');
    key(' ');
  }
  await advance(0);
  expect(v.getByText('Готово')).toBeTruthy();
  return Number(v.container.textContent?.match(/Очищено линий: (\d+)/)?.[1] ?? 0);
};
const mountWithWatcher = () => {
  const v = rtl.render(
    <>
      <Watcher />
      <MiniGames />
    </>,
  );
  rtl.fireEvent.click(v.getByText('Тетрис'));
  rtl.fireEvent.click(v.getByText('Старт'));
  return v;
};
const finishWithLines = async (target: number) => {
  const v = mountWithWatcher();
  const played = await playExact(v, target);
  expect(played).toBe(target);
  const final = await finishSafely(v);
  return { v, final };
};

beforeEach(() => {
  jest.useFakeTimers();
  rtl.cleanup();
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  setEnergy(80);
  resetAch();
  if (origGain) usePetStore.setState({ gainExp: origGain } as never);
  origGain = trackGains();
});

describe('Достижение «Мастер линий» (catcher)', () => {
  test('id, редкость и награда сохранены, название, описание и иконка обновлены', () => {
    const c = catcher();
    expect(c.id).toBe('catcher');
    expect(c.rarity).toBe('epic');
    expect(c.xp).toBe(100);
    expect(c.category).toBe('games');
    expect(c.title).toBe('Мастер линий');
    expect(c.desc).toContain('10 линий');
    expect(c.desc).toContain('Тетрис');
    expect(c.icon).toBe('Blocks');
    expect(c.goal).toBe(10);
    expect(ACHIEVEMENTS.filter((x) => x.id === 'catcher').length).toBe(1);
  });

  test('прогресс считается по tetrisLinesBest, а не по catchBest', () => {
    const c = catcher();
    const base = { pet: usePetStore.getState(), gamesPlayed: [], petsOwned: [], days: [] };
    expect(progressOf(c, { ...base, c: { tetrisLinesBest: 5 } } as never)).toBe(0.5);
    expect(progressOf(c, { ...base, c: { catchBest: 500 } } as never)).toBe(0);
    expect(progressOf(c, { ...base, c: { tetrisLinesBest: 25 } } as never)).toBe(1);
  });

  test('завершённая партия с 9 линиями не открывает достижение', async () => {
    const { final } = await finishWithLines(9);
    expect(final).toBe(9);
    expect(best()).toBe(9);
    expect(unlockedAt()).toBeUndefined();
  });

  test('завершённая партия с 10 линиями открывает достижение и даёт награду', async () => {
    const { final, v } = await finishWithLines(10);
    expect(final).toBe(10);
    expect(best()).toBe(10);
    await advance(0);
    expect(unlockedAt()).toBeGreaterThan(0);
    expect(ach_().queue.filter((x) => x === 'catcher').length).toBe(1);
    expect(bigGains()).toBe(1);
    expect(gains).toContain(50);
    expect(v.getByText('Готово')).toBeTruthy();
  });

  test('повторное завершение не начисляет награду достижения второй раз', async () => {
    const { v } = await finishWithLines(10);
    await advance(0);
    const stamp = unlockedAt();
    const gains1 = gains.length;
    const queue1 = ach_().queue.filter((x) => x === 'catcher').length;
    rtl.fireEvent.click(v.getByText('Ещё раз'));
    await playExact(v, 10);
    await finishSafely(v);
    await advance(0);
    expect(best()).toBe(10);
    expect(unlockedAt()).toBe(stamp);
    expect(ach_().queue.filter((x) => x === 'catcher').length).toBe(queue1);
    expect(bigGains()).toBe(1);
    expect(gains.slice(gains1)).toEqual([50]);
  });

  test('рекорд не снижается после худшей партии', async () => {
    const { v } = await finishWithLines(3);
    expect(best()).toBe(3);
    rtl.fireEvent.click(v.getByText('Ещё раз'));
    await finishSafely(v);
    expect(best()).toBe(3);
  });

  test('рекорд обновляется один раз за партию и повторные клавиши после конца его не меняют', async () => {
    const { v } = await finishWithLines(2);
    const b = best();
    for (let i = 0; i < 5; i++) key(' ');
    await advance(60000);
    expect(best()).toBe(b);
    expect(counters().games).toBe(1);
    expect(v.getByText('Готово')).toBeTruthy();
  });

  test('партия без линий записывает рекорд 0 и достижение не открывает', async () => {
    const v = mountWithWatcher();
    await finishSafely(v);
    expect(best() ?? 0).toBe(0);
    expect(unlockedAt()).toBeUndefined();
  });

  test('старое открытое catcher остаётся открытым без новой награды', async () => {
    const stamp = 1700000000000;
    resetAch({ unlocked: { catcher: stamp }, counters: { catchBest: 200, games: 4 } });
    const v = rtl.render(<Watcher />);
    await advance(0);
    expect(unlockedAt()).toBe(stamp);
    expect(bigGains()).toBe(0);
    expect(ach_().queue).not.toContain('catcher');
    v.unmount();
    const t = mountWithWatcher();
    await finishSafely(t);
    await advance(0);
    expect(unlockedAt()).toBe(stamp);
    expect(bigGains()).toBe(0);
    expect(ach_().queue).not.toContain('catcher');
  });

  test('старое открытое catcher: рекорд в 10 линий не даёт награду повторно', async () => {
    const stamp = 1700000000000;
    resetAch({ unlocked: { catcher: stamp } });
    await finishWithLines(10);
    await advance(0);
    expect(unlockedAt()).toBe(stamp);
    expect(best()).toBe(10);
    expect(bigGains()).toBe(0);
    expect(gains).toContain(50);
    expect(ach_().queue).not.toContain('catcher');
  });

  test('старый высокий catchBest сам по себе не открывает новое достижение', async () => {
    resetAch({ counters: { catchBest: 999 } });
    const v = rtl.render(<Watcher />);
    await advance(0);
    expect(unlockedAt()).toBeUndefined();
    expect(bigGains()).toBe(0);
    expect(best()).toBeUndefined();
    expect(counters().catchBest).toBe(999);
    v.unmount();
  });

  test('старый catchBest не переводится в линии и не мешает новому прогрессу', async () => {
    resetAch({ counters: { catchBest: 999, games: 3, snakeBest: 7 } });
    await finishWithLines(2);
    expect(best()).toBe(2);
    expect(counters().catchBest).toBe(999);
    expect(unlockedAt()).toBeUndefined();
  });

  test('досрочный выход не обновляет рекорд', async () => {
    const v = mountWithWatcher();
    const played = await playExact(v, 4);
    expect(played).toBe(4);
    back(v);
    await advance(60000);
    expect(best()).toBeUndefined();
    expect(unlockedAt()).toBeUndefined();
    expect(counters().games).toBeUndefined();
  });

  test('досрочный выход не понижает уже сохранённый рекорд и не повышает его', async () => {
    resetAch({ counters: { tetrisLinesBest: 6 } });
    const v = mountWithWatcher();
    await playExact(v, 8);
    back(v);
    await advance(60000);
    expect(best()).toBe(6);
  });

  test('другой прогресс не сбрасывается', async () => {
    resetAch({ counters: { games: 5, gameWins: 2, quizPerfect: 1, snakeBest: 9, reactionBest: 210 }, gamesPlayed: ['quiz', 'snake'], days: ['2026-10-01'] });
    await finishWithLines(1);
    const s = ach_();
    expect(s.counters.games).toBe(6);
    expect(s.counters.gameWins).toBe(2);
    expect(s.counters.quizPerfect).toBe(1);
    expect(s.counters.snakeBest).toBe(9);
    expect(s.counters.reactionBest).toBe(210);
    expect(s.gamesPlayed).toEqual(['quiz', 'snake', 'tetris']);
    expect(s.days).toContain('2026-10-01');
  });

  test('остальные достижения каталога не изменились', () => {
    const ids = ACHIEVEMENTS.map((x) => x.id);
    for (const id of ['gamer', 'all_games', 'champion', 'quiz_ace', 'ttt_master', 'snake_long', 'lightning', 'catcher']) expect(ids).toContain(id);
    expect(ACHIEVEMENTS.find((x) => x.id === 'snake_long')!.title).toBe('Длинный хвост');
    expect(ACHIEVEMENTS.find((x) => x.id === 'lightning')!.title).toBe('Молния');
  });
});
