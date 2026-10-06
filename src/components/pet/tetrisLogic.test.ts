// @ts-expect-error bun:test доступен только при запуске через bun
import { describe, expect, test } from 'bun:test';
import {
  COLS,
  ROWS,
  KINDS,
  cellsOf,
  collides,
  drawFromBag,
  dropPosition,
  emptyBoard,
  gravityTick,
  hardDrop,
  levelFor,
  lockPiece,
  moveH,
  newGame,
  rewardFor,
  rotateCW,
  shapeOf,
  shuffleBag,
  softDrop,
  speedMs,
  spawnPiece,
  type Kind,
  type Piece,
  type TetrisState,
} from './tetrisLogic';

const seeded = (seed = 1) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const stateWith = (kind: Kind, over: Partial<TetrisState> = {}, piece: Partial<Piece> = {}): TetrisState => ({
  ...newGame(seeded(7)),
  piece: { ...spawnPiece(kind), ...piece },
  ...over,
});
const fillRow = (b: number[][], y: number, except: number[] = []) => {
  for (let x = 0; x < COLS; x++) if (!except.includes(x)) b[y][x] = 1;
};

describe('фигуры и поле', () => {
  test('поле 10 × 20', () => {
    const b = emptyBoard();
    expect(COLS).toBe(10);
    expect(ROWS).toBe(20);
    expect(b.length).toBe(20);
    expect(b.every((r) => r.length === 10 && r.every((v) => v === 0))).toBe(true);
  });

  test('семь стандартных фигур, в каждой по четыре блока в каждом повороте', () => {
    expect(new Set(KINDS).size).toBe(7);
    expect([...KINDS].sort().join('')).toBe('IJLOSTZ');
    for (const k of KINDS) for (let r = 0; r < 4; r++) expect(cellsOf({ kind: k, rot: r, x: 0, y: 0 }).length).toBe(4);
  });

  test('форма I горизонтальна, потом вертикальна', () => {
    expect(shapeOf('I', 0)[1]).toEqual([1, 1, 1, 1]);
    const v = cellsOf({ kind: 'I', rot: 1, x: 0, y: 0 });
    expect(new Set(v.map((c) => c.x)).size).toBe(1);
    expect(new Set(v.map((c) => c.y)).size).toBe(4);
  });

  test('поворот на 360° возвращает исходную форму', () => {
    for (const k of KINDS) expect(shapeOf(k, 4)).toEqual(shapeOf(k, 0));
  });

  test('новая фигура появляется по центру сверху', () => {
    for (const k of KINDS) {
      const xs = cellsOf(spawnPiece(k)).map((c) => c.x);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(3);
      expect(Math.max(...xs)).toBeLessThanOrEqual(6);
      expect(Math.min(...cellsOf(spawnPiece(k)).map((c) => c.y))).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('пакеты по семь', () => {
  test('каждый пакет содержит все семь фигур ровно по разу', () => {
    for (let i = 1; i <= 20; i++) expect([...shuffleBag(seeded(i))].sort()).toEqual([...KINDS].sort());
  });

  test('пакеты перемешаны по-разному', () => {
    const orders = new Set(Array.from({ length: 10 }, (_, i) => shuffleBag(seeded(i + 1)).join('')));
    expect(orders.size).toBeGreaterThan(1);
  });

  test('в каждых семи подряд выданных фигурах (по пакетам) нет повторов', () => {
    const rng = seeded(42);
    let bag: Kind[] = [];
    const out: Kind[] = [];
    for (let i = 0; i < 70; i++) {
      const [k, rest] = drawFromBag(bag, rng);
      out.push(k);
      bag = rest;
    }
    for (let i = 0; i < 70; i += 7) expect(new Set(out.slice(i, i + 7)).size).toBe(7);
  });

  test('при крайних значениях генератора перемешивание не ломается', () => {
    for (const v of [0, 0.999999]) expect([...shuffleBag(() => v)].sort()).toEqual([...KINDS].sort());
  });
});

describe('столкновения и движение', () => {
  test('стены и пол считаются столкновением', () => {
    const b = emptyBoard();
    expect(collides(b, { kind: 'O', rot: 0, x: -1, y: 0 })).toBe(true);
    expect(collides(b, { kind: 'O', rot: 0, x: COLS - 1, y: 0 })).toBe(true);
    expect(collides(b, { kind: 'O', rot: 0, x: 4, y: ROWS - 1 })).toBe(true);
    expect(collides(b, { kind: 'O', rot: 0, x: 4, y: ROWS - 2 })).toBe(false);
  });

  test('занятая клетка — столкновение', () => {
    const b = emptyBoard();
    b[5][5] = 3;
    expect(collides(b, { kind: 'O', rot: 0, x: 4, y: 4 })).toBe(true);
    expect(collides(b, { kind: 'O', rot: 0, x: 6, y: 4 })).toBe(false);
  });

  test('движение влево и вправо останавливается у стен', () => {
    let s = stateWith('O');
    for (let i = 0; i < 20; i++) s = moveH(s, -1);
    expect(Math.min(...cellsOf(s.piece).map((c) => c.x))).toBe(0);
    for (let i = 0; i < 20; i++) s = moveH(s, 1);
    expect(Math.max(...cellsOf(s.piece).map((c) => c.x))).toBe(COLS - 1);
  });

  test('движение в занятую клетку блокируется', () => {
    const s = stateWith('O', {}, { x: 4, y: 5 });
    s.board[5][6] = 2;
    expect(moveH(s, 1)).toBe(s);
  });

  test('гравитация опускает фигуру на одну клетку', () => {
    const s = stateWith('T');
    expect(gravityTick(s).piece.y).toBe(s.piece.y + 1);
  });

  test('фигура фиксируется на полу и появляется следующая', () => {
    let s = stateWith('O', {}, { y: ROWS - 2 });
    const next = s.next;
    s = gravityTick(s);
    expect(s.board[ROWS - 1].some((v) => v !== 0)).toBe(true);
    expect(s.piece.kind).toBe(next);
    expect(s.piece.y).toBe(0);
  });

  test('фигура ложится на другие блоки', () => {
    const s = stateWith('O', {}, { x: 4, y: 10 });
    s.board[12][4] = 1;
    const after = gravityTick(s);
    expect(after.board[10][4]).not.toBe(0);
    expect(after.board[11][5]).not.toBe(0);
  });

  test('ускоренное падение даёт очко за клетку и фиксирует у дна', () => {
    let s = stateWith('O');
    const s1 = softDrop(s);
    expect(s1.piece.y).toBe(1);
    expect(s1.score).toBe(1);
    s = stateWith('O', {}, { y: ROWS - 2 });
    expect(softDrop(s).board[ROWS - 1].some((v) => v !== 0)).toBe(true);
  });

  test('мгновенный сброс: фигура сразу внизу, очки за дальность', () => {
    const s = stateWith('O');
    const after = hardDrop(s);
    expect(after.board[ROWS - 1].filter((v) => v !== 0).length).toBe(2);
    expect(after.board[ROWS - 2].filter((v) => v !== 0).length).toBe(2);
    expect(after.score).toBe((ROWS - 2) * 2);
    expect(after.piece.y).toBe(0);
  });

  test('призрак совпадает с позицией сброса', () => {
    const s = stateWith('T', {}, { x: 3 });
    s.board[15][4] = 1;
    const ghost = dropPosition(s.board, s.piece);
    expect(collides(s.board, ghost)).toBe(false);
    expect(collides(s.board, { ...ghost, y: ghost.y + 1 })).toBe(true);
  });
});

describe('повороты у границ', () => {
  test('поворот на открытом месте', () => {
    const s = stateWith('T', {}, { y: 5 });
    expect(rotateCW(s).piece.rot).toBe(1);
  });

  test('O не поворачивается', () => {
    const s = stateWith('O');
    expect(rotateCW(s)).toBe(s);
  });

  test('вертикальная I у левой стены поворачивается со сдвигом внутрь поля', () => {
    let s = stateWith('I', {}, { y: 5, rot: 1, x: -2 });
    expect(collides(s.board, s.piece)).toBe(false);
    s = rotateCW(s);
    expect(s.piece.rot).toBe(2);
    expect(collides(s.board, s.piece)).toBe(false);
    expect(Math.min(...cellsOf(s.piece).map((c) => c.x))).toBeGreaterThanOrEqual(0);
  });

  test('вертикальная I у правой стены поворачивается без выхода за поле', () => {
    let s = stateWith('I', {}, { y: 5, rot: 1, x: COLS - 3 });
    expect(collides(s.board, s.piece)).toBe(false);
    s = rotateCW(s);
    expect(s.piece.rot).toBe(2);
    expect(Math.max(...cellsOf(s.piece).map((c) => c.x))).toBeLessThanOrEqual(COLS - 1);
    expect(collides(s.board, s.piece)).toBe(false);
  });

  test('поворот у пола поднимает фигуру, а не проваливает', () => {
    let s = stateWith('I', {}, { y: ROWS - 4, rot: 1, x: 3 });
    expect(collides(s.board, s.piece)).toBe(false);
    s = rotateCW(s);
    expect(s.piece.rot).toBe(2);
    expect(collides(s.board, s.piece)).toBe(false);
  });

  test('поворот, для которого нет места, отклоняется без изменений', () => {
    const s = stateWith('I', {}, { y: 5, rot: 1, x: 3 });
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!cellsOf(s.piece).some((c) => c.x === x && c.y === y)) s.board[y][x] = 1;
    expect(rotateCW(s)).toBe(s);
  });

  test('любой поворот у любой границы заканчивается без столкновений', () => {
    for (const k of KINDS) {
      for (const x of [-2, -1, 0, 3, COLS - 4, COLS - 3, COLS - 2]) {
        for (const y of [0, 8, ROWS - 4]) {
          const s = stateWith(k, {}, { x, y, rot: 0 });
          if (collides(s.board, s.piece)) continue;
          let cur = s;
          for (let i = 0; i < 4; i++) {
            cur = rotateCW(cur);
            expect(collides(cur.board, cur.piece)).toBe(false);
          }
        }
      }
    }
  });
});

describe('линии', () => {
  test('одна полная линия удаляется, блоки сверху опускаются', () => {
    const s = stateWith('I', {}, { rot: 0, x: 3, y: ROWS - 3 });
    fillRow(s.board, ROWS - 2, [3, 4, 5, 6]);
    s.board[ROWS - 3][0] = 5;
    const lockedI = { ...s.piece, y: ROWS - 3 };
    const after = lockPiece(s, lockedI);
    expect(after.lines).toBe(1);
    expect(after.board[ROWS - 2][0]).toBe(5);
    expect(after.board[ROWS - 3].every((v) => v === 0)).toBe(true);
    expect(after.board[ROWS - 1].every((v) => v === 0)).toBe(true);
    expect(after.board.length).toBe(ROWS);
  });

  test('сохраняется порядок оставшихся рядов', () => {
    const s = stateWith('I', {}, { rot: 0, x: 3 });
    fillRow(s.board, ROWS - 1, [3, 4, 5, 6]);
    s.board[ROWS - 2][1] = 4;
    s.board[ROWS - 3][2] = 6;
    const after = lockPiece(s, { ...s.piece, y: ROWS - 2 });
    expect(after.lines).toBe(1);
    expect(after.board[ROWS - 1][1]).toBe(4);
    expect(after.board[ROWS - 2][2]).toBe(6);
  });

  test('несколько линий одновременно: очки по таблице × уровень', () => {
    const table: Array<[number, number]> = [[1, 100], [2, 300], [3, 500], [4, 800]];
    for (const [n, pts] of table) {
      const s = stateWith('I', {}, { rot: 1, x: 7, y: ROWS - 4 });
      for (let i = 0; i < n; i++) fillRow(s.board, ROWS - 1 - i, [9]);
      for (let i = n; i < 4; i++) fillRow(s.board, ROWS - 1 - i, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const after = lockPiece(s, { ...s.piece, x: 7, y: ROWS - 4 });
      expect(after.lastCleared).toBe(n);
      expect(after.lines).toBe(n);
      expect(after.score).toBe(pts);
    }
  });

  test('четыре линии (тетрис) за один ход', () => {
    const s = stateWith('I', {}, { rot: 1 });
    for (let i = 0; i < 4; i++) fillRow(s.board, ROWS - 1 - i, [9]);
    const piece = { kind: 'I' as Kind, rot: 1, x: 7, y: ROWS - 4 };
    expect(cellsOf(piece).every((c) => c.x === 9)).toBe(true);
    const after = lockPiece(s, piece);
    expect(after.lines).toBe(4);
    expect(after.board.every((r) => r.every((v) => v === 0))).toBe(true);
  });

  test('неполные линии не удаляются', () => {
    const s = stateWith('O', {}, { y: 5 });
    fillRow(s.board, ROWS - 1, [0, 1]);
    const after = lockPiece(s);
    expect(after.lines).toBe(0);
    expect(after.board[ROWS - 1].filter((v) => v !== 0).length).toBe(8);
  });

  test('счётчик событий очистки растёт только при очистке', () => {
    const s = stateWith('O', {}, { y: 5 });
    expect(lockPiece(s).clearId).toBe(0);
    const t = stateWith('I', {}, { rot: 1 });
    fillRow(t.board, ROWS - 1, [9]);
    expect(lockPiece(t, { kind: 'I', rot: 1, x: 7, y: ROWS - 4 }).clearId).toBe(1);
  });
});

describe('уровни, скорость, награда', () => {
  test('уровень растёт каждые 10 линий', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(9)).toBe(1);
    expect(levelFor(10)).toBe(2);
    expect(levelFor(25)).toBe(3);
  });

  test('скорость постепенно растёт и ограничена снизу', () => {
    let prev = Infinity;
    for (let l = 1; l <= 10; l++) {
      expect(speedMs(l)).toBeLessThanOrEqual(prev);
      prev = speedMs(l);
    }
    expect(speedMs(1)).toBe(800);
    expect(speedMs(2)).toBeLessThan(speedMs(1));
    expect(speedMs(99)).toBe(90);
  });

  test('награда: min(60, линии × 5), при нуле линий — ноль', () => {
    expect(rewardFor(0)).toBe(0);
    expect(rewardFor(1)).toBe(5);
    expect(rewardFor(7)).toBe(35);
    expect(rewardFor(12)).toBe(60);
    expect(rewardFor(40)).toBe(60);
    expect(rewardFor(-3)).toBe(0);
  });
});

describe('проигрыш', () => {
  test('игра окончена, когда новая фигура не может появиться', () => {
    const s = stateWith('O', {}, { y: 5 });
    for (let x = 0; x < COLS; x++) s.board[1][x] = 1;
    s.board[1][0] = 0;
    const after = lockPiece(s);
    expect(after.over).toBe(true);
  });

  test('свободное место — игра продолжается', () => {
    const s = stateWith('O', {}, { y: 5 });
    expect(lockPiece(s).over).toBe(false);
  });

  test('после проигрыша действия не меняют состояние', () => {
    const s = { ...stateWith('T'), over: true };
    expect(moveH(s, 1)).toBe(s);
    expect(rotateCW(s)).toBe(s);
    expect(gravityTick(s)).toBe(s);
    expect(softDrop(s)).toBe(s);
    expect(hardDrop(s)).toBe(s);
  });

  test('полная партия без управления заканчивается проигрышем', () => {
    let s = newGame(seeded(3));
    for (let i = 0; i < 2000 && !s.over; i++) s = hardDrop(s);
    expect(s.over).toBe(true);
    expect(s.lines).toBe(0);
  });

  test('«следующая фигура» становится текущей', () => {
    const s = newGame(seeded(9));
    const next = s.next;
    expect(hardDrop(s).piece.kind).toBe(next);
  });
});
