export const COLS = 10;
export const ROWS = 20;

export type Kind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export const KINDS: Kind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
export type Rng = () => number;
export type Board = number[][];
export type Matrix = number[][];

export interface Piece {
  kind: Kind;
  rot: number;
  x: number;
  y: number;
}

export interface TetrisState {
  board: Board;
  piece: Piece;
  next: Kind;
  bag: Kind[];
  rng: Rng;
  score: number;
  lines: number;
  level: number;
  over: boolean;
  clearId: number;
  lastCleared: number;
}

const BASE: Record<Kind, Matrix> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

const rotateMatrix = (m: Matrix): Matrix => m[0].map((_, c) => m.map((row) => row[c]).reverse());

const SHAPES: Record<Kind, Matrix[]> = Object.fromEntries(
  KINDS.map((k) => {
    const rots: Matrix[] = [BASE[k]];
    for (let i = 1; i < 4; i++) rots.push(rotateMatrix(rots[i - 1]));
    return [k, rots];
  }),
) as Record<Kind, Matrix[]>;

export const kindIndex = (k: Kind) => KINDS.indexOf(k) + 1;
export const shapeOf = (kind: Kind, rot: number): Matrix => SHAPES[kind][((rot % 4) + 4) % 4];

export function cellsOf(p: Piece): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  shapeOf(p.kind, p.rot).forEach((row, r) =>
    row.forEach((v, c) => {
      if (v) out.push({ x: p.x + c, y: p.y + r });
    }),
  );
  return out;
}

export const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

export function collides(board: Board, p: Piece): boolean {
  return cellsOf(p).some(({ x, y }) => x < 0 || x >= COLS || y < 0 || y >= ROWS || board[y][x] !== 0);
}

export function shuffleBag(rng: Rng): Kind[] {
  const bag = [...KINDS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function drawFromBag(bag: Kind[], rng: Rng): [Kind, Kind[]] {
  const source = bag.length ? bag : shuffleBag(rng);
  return [source[0], source.slice(1)];
}

export function spawnPiece(kind: Kind): Piece {
  const width = shapeOf(kind, 0)[0].length;
  return { kind, rot: 0, x: Math.floor((COLS - width) / 2), y: 0 };
}

export function newGame(rng: Rng): TetrisState {
  const [first, bag1] = drawFromBag([], rng);
  const [next, bag2] = drawFromBag(bag1, rng);
  return {
    board: emptyBoard(),
    piece: spawnPiece(first),
    next,
    bag: bag2,
    rng,
    score: 0,
    lines: 0,
    level: 1,
    over: false,
    clearId: 0,
    lastCleared: 0,
  };
}

const LINE_POINTS = [0, 100, 300, 500, 800];
export const levelFor = (lines: number) => Math.floor(lines / 10) + 1;
export const speedMs = (level: number) => Math.max(90, 800 - (level - 1) * 70);
export const rewardFor = (lines: number) => Math.min(60, Math.max(0, lines) * 5);

export function lockPiece(s: TetrisState, piece: Piece = s.piece): TetrisState {
  const merged = s.board.map((row) => [...row]);
  const id = kindIndex(piece.kind);
  for (const { x, y } of cellsOf(piece)) merged[y][x] = id;

  const kept = merged.filter((row) => row.some((v) => v === 0));
  const cleared = ROWS - kept.length;
  const board = [...Array.from({ length: cleared }, () => Array(COLS).fill(0)), ...kept];
  const lines = s.lines + cleared;
  const [next, bag] = drawFromBag(s.bag, s.rng);
  const spawned = spawnPiece(s.next);

  return {
    ...s,
    board,
    piece: spawned,
    next,
    bag,
    lines,
    level: levelFor(lines),
    score: s.score + LINE_POINTS[cleared] * s.level,
    over: collides(board, spawned),
    clearId: cleared > 0 ? s.clearId + 1 : s.clearId,
    lastCleared: cleared,
  };
}

export function moveH(s: TetrisState, dx: number): TetrisState {
  if (s.over) return s;
  const piece = { ...s.piece, x: s.piece.x + dx };
  return collides(s.board, piece) ? s : { ...s, piece };
}

const KICKS: Array<[number, number]> = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]];

export function rotateCW(s: TetrisState): TetrisState {
  if (s.over || s.piece.kind === 'O') return s;
  const rot = (s.piece.rot + 1) % 4;
  for (const [dx, dy] of KICKS) {
    const piece = { ...s.piece, rot, x: s.piece.x + dx, y: s.piece.y + dy };
    if (!collides(s.board, piece)) return { ...s, piece };
  }
  return s;
}

export function gravityTick(s: TetrisState): TetrisState {
  if (s.over) return s;
  const piece = { ...s.piece, y: s.piece.y + 1 };
  return collides(s.board, piece) ? lockPiece(s) : { ...s, piece };
}

export function softDrop(s: TetrisState): TetrisState {
  if (s.over) return s;
  const piece = { ...s.piece, y: s.piece.y + 1 };
  return collides(s.board, piece) ? lockPiece(s) : { ...s, piece, score: s.score + 1 };
}

export function dropPosition(board: Board, piece: Piece): Piece {
  let p = piece;
  while (!collides(board, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
  return p;
}

export function hardDrop(s: TetrisState): TetrisState {
  if (s.over) return s;
  const landed = dropPosition(s.board, s.piece);
  const dist = landed.y - s.piece.y;
  return lockPiece({ ...s, score: s.score + dist * 2 }, landed);
}
