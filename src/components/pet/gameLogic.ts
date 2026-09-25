export type Cell = { x: number; y: number };
export type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
const GRID = 20;
export const OPP: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

export function nextSnakeStep(snake: Cell[], dir: Dir, food: Cell): { snake: Cell[]; ate: boolean; dead: boolean } {
  const head = { ...snake[0] };
  if (dir === 'UP') head.y -= 1;
  if (dir === 'DOWN') head.y += 1;
  if (dir === 'LEFT') head.x -= 1;
  if (dir === 'RIGHT') head.x += 1;
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) return { snake, ate: false, dead: true };
  const ate = head.x === food.x && head.y === food.y;
  const body = ate ? snake : snake.slice(0, -1);
  if (body.some((c) => c.x === head.x && c.y === head.y)) return { snake, ate: false, dead: true };
  return { snake: [head, ...body], ate, dead: false };
}

export function placeFood(snake: Cell[]): Cell | null {
  const taken = new Set(snake.map((c) => c.y * GRID + c.x));
  const free: number[] = [];
  for (let i = 0; i < GRID * GRID; i++) if (!taken.has(i)) free.push(i);
  if (!free.length) return null;
  const k = free[Math.floor(Math.random() * free.length)];
  return { x: k % GRID, y: Math.floor(k / GRID) };
}

export const rewardLabel = (n: number | null) =>
  n === null ? undefined : n > 0 ? `+${n} опыта` : n < 0 ? 'Лимит опыта за эту игру на сегодня исчерпан' : 'В этот раз без опыта';

export const chaseReward = (caught: number) => Math.max(5, 60 - caught * 8);
