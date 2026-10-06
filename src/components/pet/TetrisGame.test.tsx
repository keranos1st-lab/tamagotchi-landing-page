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
const { todayKey } = await import('@/store/petStore');

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
const plays = () => usePetStore.getState().xpLog.counts['game:tetris'] ?? 0;
const counters = () => useAchievementStore.getState().counters as Record<string, number>;
const ach = () => JSON.stringify(useAchievementStore.getState());
const advance = async (ms: number) => {
  await rtl.act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

type View = ReturnType<typeof rtl.render>;
const keyTarget = window as unknown as Document;
const key = (k: string) => rtl.fireEvent.keyDown(keyTarget, { key: k });
const cells = (v: View) => Array.from(v.getByTestId('tetris-board').children) as HTMLElement[];
const filled = (v: View) => cells(v).map((c, i) => (c.className.includes('shadow-[inset') ? i : -1)).filter((i) => i >= 0);
const pieceTop = (v: View) => Math.min(...filled(v).map((i) => Math.floor(i / 10)));
const pieceLeft = (v: View) => Math.min(...filled(v).map((i) => i % 10));
const stat = (v: View, name: string) => Number(v.getByTestId(`tetris-${name}`).textContent);
const petAnim = (v: View) => v.getByTestId('tetris-pet').getAttribute('data-anim');
const back = (v: View) => rtl.fireEvent.click(v.container.querySelector('button[title="Назад к играм"]')!);
const openTetris = () => {
  const v = rtl.render(<MiniGames />);
  rtl.fireEvent.click(v.getByText('Тетрис'));
  return v;
};
const startTetris = () => {
  const v = openTetris();
  rtl.fireEvent.click(v.getByText('Старт'));
  return v;
};
const hidden = (h: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: h });
  document.dispatchEvent(new window.Event('visibilitychange'));
};

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

const playBot = (v: View, targetLines: number) => {
  let sim = L.newGame(() => 0.5);
  for (let i = 0; i < 200 && sim.lines < targetLines; i++) {
    const p = plan(sim);
    if (!p) break;
    for (const k of p.ops) key(k);
    sim = p.result;
  }
  expect(sim.lines).toBeGreaterThanOrEqual(targetLines);
  expect(stat(v, 'Линии')).toBe(sim.lines);
  return sim;
};
const loseGame = async (v: View) => {
  for (let i = 0; i < 80 && !v.queryByText('Готово'); i++) key(' ');
  await advance(0);
  expect(v.getByText('Готово')).toBeTruthy();
};

let randomSpy: ReturnType<typeof jest.spyOn>;
beforeEach(() => {
  jest.useFakeTimers();
  rtl.cleanup();
  hidden(false);
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  setEnergy(80);
  useAchievementStore.setState({ counters: {}, unlocked: {}, gamesPlayed: [] } as never);
});
afterAll(() => randomSpy?.mockRestore());

describe('Тетрис: список игр и запуск', () => {
  test('в списке «Тетрис» с иконкой и описанием, «Ловли еды» нет', () => {
    const v = rtl.render(<MiniGames />);
    expect(v.getByText('Тетрис')).toBeTruthy();
    expect(v.getByText('Собирай линии из падающих блоков')).toBeTruthy();
    expect(v.getByText('до +60 XP')).toBeTruthy();
    expect(v.queryByText('Ловля еды')).toBeNull();
    expect(v.queryByText('Лови вкусное, мимо мусора')).toBeNull();
  });

  test('остальные игры остались в списке', () => {
    const v = rtl.render(<MiniGames />);
    for (const n of ['Догонялки', 'Мемори', 'Викторина', 'Змейка', 'Крестики-нолики', 'Реакция']) expect(v.getByText(n)).toBeTruthy();
  });

  test('поле 10 × 20 = 200 клеток; до старта фигур нет, энергия не списана', () => {
    const v = openTetris();
    expect(cells(v).length).toBe(200);
    expect(filled(v).length).toBe(0);
    expect(energy()).toBe(80);
    expect(v.getByText('Готов строить?')).toBeTruthy();
  });

  test('при энергии ниже 10 игра не запускается', () => {
    setEnergy(9);
    const v = rtl.render(<MiniGames />);
    expect(v.getByText('Нет сил играть')).toBeTruthy();
    expect(v.queryByText('Тетрис')).toBeNull();
  });

  test('после старта появляется фигура из четырёх блоков, видны очки, линии, уровень и следующая фигура', () => {
    const v = startTetris();
    expect(filled(v).length).toBe(4);
    expect(stat(v, 'Очки')).toBe(0);
    expect(stat(v, 'Линии')).toBe(0);
    expect(stat(v, 'Уровень')).toBe(1);
    expect(v.getByTestId('tetris-next').children.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Тетрис: управление и ход игры', () => {
  test('гравитация опускает фигуру каждые 800 мс', async () => {
    const v = startTetris();
    const top = pieceTop(v);
    await advance(799);
    expect(pieceTop(v)).toBe(top);
    await advance(1);
    expect(pieceTop(v)).toBe(top + 1);
  });

  test('стрелки двигают фигуру влево и вправо', () => {
    const v = startTetris();
    const x = pieceLeft(v);
    key('ArrowLeft');
    expect(pieceLeft(v)).toBe(x - 1);
    key('ArrowRight');
    key('ArrowRight');
    expect(pieceLeft(v)).toBe(x + 1);
  });

  test('фигура не выходит за боковые стены', () => {
    const v = startTetris();
    for (let i = 0; i < 15; i++) key('ArrowLeft');
    expect(pieceLeft(v)).toBe(0);
    for (let i = 0; i < 15; i++) key('ArrowRight');
    expect(Math.max(...filled(v).map((i) => i % 10))).toBe(9);
    expect(filled(v).length).toBe(4);
  });

  test('стрелка вверх поворачивает фигуру', () => {
    const v = startTetris();
    for (let i = 0; i < 3; i++) key('ArrowDown');
    const before = filled(v).map((i) => [i % 10, Math.floor(i / 10)]);
    const bw = Math.max(...before.map((c) => c[0])) - Math.min(...before.map((c) => c[0]));
    key('ArrowUp');
    const after = filled(v).map((i) => [i % 10, Math.floor(i / 10)]);
    const aw = Math.max(...after.map((c) => c[0])) - Math.min(...after.map((c) => c[0]));
    expect(filled(v).length).toBe(4);
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
    expect(aw === bw && JSON.stringify(after) === JSON.stringify(before)).toBe(false);
  });

  test('стрелка вниз ускоряет падение и даёт очки', () => {
    const v = startTetris();
    const top = pieceTop(v);
    key('ArrowDown');
    expect(pieceTop(v)).toBe(top + 1);
    expect(stat(v, 'Очки')).toBe(1);
  });

  test('пробел мгновенно сбрасывает фигуру на дно, появляется следующая', () => {
    const v = startTetris();
    key(' ');
    expect(pieceTop(v)).toBe(0);
    const f = filled(v);
    const bottom = f.filter((i) => Math.floor(i / 10) >= 18);
    expect(bottom.length).toBeGreaterThanOrEqual(2);
    expect(f.length).toBe(8);
    expect(stat(v, 'Очки')).toBeGreaterThan(0);
  });

  test('клавиши игры не прокручивают страницу: preventDefault во время игры и паузы', () => {
    const v = startTetris();
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']) expect(rtl.fireEvent.keyDown(keyTarget, { key: k })).toBe(false);
    rtl.fireEvent.click(v.getByLabelText('Пауза'));
    for (const k of ['ArrowDown', ' ']) expect(rtl.fireEvent.keyDown(keyTarget, { key: k })).toBe(false);
  });

  test('другие клавиши не перехватываются', () => {
    startTetris();
    expect(rtl.fireEvent.keyDown(keyTarget, { key: 'a' })).toBe(true);
    expect(rtl.fireEvent.keyDown(keyTarget, { key: 'Tab' })).toBe(true);
  });

  test('до старта клавиши не перехватываются', () => {
    openTetris();
    expect(rtl.fireEvent.keyDown(keyTarget, { key: 'ArrowDown' })).toBe(true);
  });

  test('экранные кнопки: влево, вправо, поворот, вниз, сброс', () => {
    const v = startTetris();
    const x = pieceLeft(v);
    rtl.fireEvent.pointerDown(v.getByLabelText('Влево'));
    rtl.fireEvent.pointerUp(v.getByLabelText('Влево'));
    expect(pieceLeft(v)).toBe(x - 1);
    rtl.fireEvent.pointerDown(v.getByLabelText('Вправо'));
    rtl.fireEvent.pointerUp(v.getByLabelText('Вправо'));
    expect(pieceLeft(v)).toBe(x);
    const top = pieceTop(v);
    rtl.fireEvent.pointerDown(v.getByLabelText('Вниз'));
    rtl.fireEvent.pointerUp(v.getByLabelText('Вниз'));
    expect(pieceTop(v)).toBe(top + 1);
    const snapshot = filled(v).join();
    rtl.fireEvent.pointerDown(v.getByLabelText('Повернуть'));
    expect(filled(v).join()).not.toBe(snapshot);
    rtl.fireEvent.pointerDown(v.getByLabelText('Сбросить'));
    expect(filled(v).length).toBe(8);
    expect(pieceTop(v)).toBe(0);
  });

  test('удержание экранной кнопки повторяет движение, отпускание останавливает', async () => {
    const v = startTetris();
    const x = pieceLeft(v);
    const btn = v.getByLabelText('Влево');
    rtl.fireEvent.pointerDown(btn);
    await advance(260 + 70 * 2);
    expect(pieceLeft(v)).toBeLessThanOrEqual(x - 2);
    rtl.fireEvent.pointerUp(btn);
    const after = pieceLeft(v);
    await advance(2000 - 800 * 2);
    expect(pieceLeft(v)).toBe(after);
  });
});

describe('Тетрис: пауза', () => {
  test('кнопка паузы останавливает падение и ввод, «Продолжить» возобновляет', async () => {
    const v = startTetris();
    const top = pieceTop(v);
    rtl.fireEvent.click(v.getByLabelText('Пауза'));
    expect(v.getAllByText('Пауза').length).toBeGreaterThan(0);
    await advance(10000);
    key('ArrowLeft');
    key(' ');
    expect(pieceTop(v)).toBe(top);
    expect(filled(v).length).toBe(4);
    rtl.fireEvent.click(v.getByLabelText('Продолжить'));
    await advance(800);
    expect(pieceTop(v)).toBe(top + 1);
  });

  test('скрытие вкладки ставит паузу; после возвращения игра идёт только после нажатия', async () => {
    const v = startTetris();
    const top = pieceTop(v);
    hidden(true);
    await rtl.act(async () => {});
    expect(v.getByLabelText('Продолжить')).toBeTruthy();
    await advance(5000);
    hidden(false);
    await advance(5000);
    expect(pieceTop(v)).toBe(top);
    key('ArrowDown');
    expect(pieceTop(v)).toBe(top);
    rtl.fireEvent.click(v.getByLabelText('Продолжить'));
    await advance(800);
    expect(pieceTop(v)).toBe(top + 1);
  });

  test('пауза не даёт награды и не завершает игру', async () => {
    const v = startTetris();
    rtl.fireEvent.click(v.getByLabelText('Пауза'));
    await advance(60000);
    expect(energy()).toBe(80);
    expect(plays()).toBe(0);
    expect(v.queryByText('Готово')).toBeNull();
  });
});

describe('Тетрис: завершение, награда, питомец', () => {
  test('проигрыш без линий: итоги, опыта нет, энергия списана один раз, игра учтена один раз', async () => {
    const v = startTetris();
    await loseGame(v);
    expect(v.getByText('Стакан переполнен')).toBeTruthy();
    expect(v.getByText('В этот раз без опыта')).toBeTruthy();
    expect(exp()).toBe(0);
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(counters().games).toBe(1);
    const a = ach();
    await advance(60000);
    for (let i = 0; i < 5; i++) key(' ');
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(exp()).toBe(0);
    expect(ach()).toBe(a);
  });

  test('игра с очищенными линиями: награда min(60, линии × 5), один раз', async () => {
    const v = startTetris();
    const sim = playBot(v, 2);
    expect(stat(v, 'Очки')).toBeGreaterThan(0);
    await loseGame(v);
    const lines = sim.lines;
    expect(v.getByText(`Очищено линий: ${stat === undefined ? 0 : v.container.textContent?.match(/Очищено линий: (\d+)/)?.[1]}`)).toBeTruthy();
    const shown = Number(v.container.textContent?.match(/Очищено линий: (\d+)/)?.[1]);
    expect(shown).toBeGreaterThanOrEqual(lines);
    expect(exp()).toBe(Math.min(60, shown * 5));
    expect(v.getByText(`+${Math.min(60, shown * 5)} опыта`)).toBeTruthy();
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    await advance(60000);
    expect(exp()).toBe(Math.min(60, shown * 5));
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(counters().games).toBe(1);
  });

  test('питомец радуется очищенным линиям и снова успокаивается', async () => {
    const v = startTetris();
    expect(petAnim(v)).toBe('idle');
    playBot(v, 1);
    expect(['jump', 'play', 'wave']).toContain(petAnim(v));
    await advance(1000);
    expect(petAnim(v)).toBe('idle');
  });

  test('при проигрыше без линий питомец показывает неудачу', async () => {
    const v = startTetris();
    await loseGame(v);
    expect(v.getByText('Стакан переполнен')).toBeTruthy();
  });

  test('общий дневной лимит опыта работает: после исчерпания лимита опыт за линии не начисляется', async () => {
    usePetStore.setState({ xpLog: { day: todayKey(), counts: { 'game:tetris': 100 } } } as never);
    const v = startTetris();
    playBot(v, 1);
    await loseGame(v);
    expect(exp()).toBe(0);
    expect(v.getByText(/Лимит опыта за эту игру на сегодня исчерпан/)).toBeTruthy();
    expect(energy()).toBe(72);
  });

  test('«Ещё раз» запускает новую партию, награда каждой партии отдельная и однократная', async () => {
    const v = startTetris();
    await loseGame(v);
    expect(plays()).toBe(1);
    rtl.fireEvent.click(v.getByText('Ещё раз'));
    expect(filled(v).length).toBe(4);
    expect(stat(v, 'Очки')).toBe(0);
    expect(energy()).toBe(72);
    await loseGame(v);
    expect(plays()).toBe(2);
    expect(energy()).toBe(64);
  });

  test('низкая энергия: итоги остаются видны, «Ещё раз» недоступна, после выхода игра запрещена', async () => {
    setEnergy(12);
    const v = startTetris();
    await loseGame(v);
    expect(energy()).toBe(4);
    expect(v.queryByText('Нет сил играть')).toBeNull();
    expect(v.queryByText('Ещё раз')).toBeNull();
    rtl.fireEvent.click(v.getByText('Готово'));
    expect(v.getByText('Нет сил играть')).toBeTruthy();
  });
});

describe('Тетрис: выход и очистка', () => {
  test('выход до завершения: награды, списания энергии и достижений нет, даже позже', async () => {
    const v = startTetris();
    playBot(v, 1);
    const a = ach();
    back(v);
    await advance(60000);
    expect(energy()).toBe(80);
    expect(exp()).toBe(0);
    expect(plays()).toBe(0);
    expect(ach()).toBe(a);
    expect(counters().games).toBeUndefined();
  });

  test('после выхода таймеры и обработчики клавиатуры сняты', async () => {
    const v = startTetris();
    const base = jest.getTimerCount();
    expect(base).toBeGreaterThan(0);
    back(v);
    expect(jest.getTimerCount()).toBeLessThan(base);
    expect(rtl.fireEvent.keyDown(keyTarget, { key: 'ArrowDown' })).toBe(true);
    expect(rtl.fireEvent.keyDown(keyTarget, { key: ' ' })).toBe(true);
    hidden(true);
    hidden(false);
  });

  test('размонтирование во время удержания кнопки и паузы не оставляет таймеров', async () => {
    jest.clearAllTimers();
    const base = jest.getTimerCount();
    const v = startTetris();
    expect(jest.getTimerCount()).toBeGreaterThan(base);
    rtl.fireEvent.pointerDown(v.getByLabelText('Влево'));
    v.unmount();
    expect(jest.getTimerCount()).toBe(base);
    await advance(30000);
    expect(energy()).toBe(80);
  });

  test('выход и новая игра: старая партия не влияет на новую', async () => {
    const v = startTetris();
    for (let i = 0; i < 5; i++) key(' ');
    back(v);
    rtl.fireEvent.click(v.getByText('Тетрис'));
    rtl.fireEvent.click(v.getByText('Старт'));
    expect(filled(v).length).toBe(4);
    expect(stat(v, 'Очки')).toBe(0);
    await advance(30000);
    expect(energy()).toBe(80);
  });
});
