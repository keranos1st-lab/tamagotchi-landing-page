import type { PetType } from '@/store/petStore';

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
const u = (path: string) => `${ORIGIN}${path}`;

export type PetAnim =
  | 'idle'
  | 'run-right'
  | 'run-left'
  | 'wave'
  | 'jump'
  | 'failed'
  | 'waiting'
  | 'working'
  | 'review'
  | 'eat'
  | 'sleep'
  | 'play'
  | 'study'
  | 'pet'
  | 'beg'
  | 'special';

export const CELL_W = 192;
export const CELL_H = 208;

export interface SheetFrame {
  src: string;
  cols: number;
  rows: number;
  row: number;
  frames: number;
  fps: number;
  effect?: string;
  cw?: number;
  ch?: number;
}

const KODIK_MAIN = { src: u('/pets/kodik.webp'), cols: 8, rows: 9 };
const KODIK_CARE = { src: u('/pets/kodik-care.webp'), cols: 4, rows: 4 };

const KODIK: Record<PetAnim, SheetFrame> = {
  idle: { ...KODIK_MAIN, row: 0, frames: 6, fps: 6 },
  'run-right': { ...KODIK_MAIN, row: 1, frames: 8, fps: 12 },
  'run-left': { ...KODIK_MAIN, row: 2, frames: 8, fps: 12 },
  wave: { ...KODIK_MAIN, row: 3, frames: 4, fps: 9 },
  jump: { ...KODIK_MAIN, row: 4, frames: 5, fps: 9 },
  failed: { ...KODIK_MAIN, row: 5, frames: 8, fps: 8 },
  waiting: { ...KODIK_MAIN, row: 6, frames: 6, fps: 6 },
  working: { ...KODIK_MAIN, row: 7, frames: 6, fps: 9 },
  review: { ...KODIK_MAIN, row: 8, frames: 6, fps: 7 },
  eat: { ...KODIK_CARE, row: 0, frames: 4, fps: 5 },
  sleep: { ...KODIK_CARE, row: 1, frames: 4, fps: 3 },
  play: { ...KODIK_CARE, row: 2, frames: 4, fps: 6 },
  study: { ...KODIK_CARE, row: 3, frames: 4, fps: 4 },
  pet: { ...KODIK_MAIN, row: 0, frames: 1, fps: 1 },
  beg: { ...KODIK_MAIN, row: 0, frames: 6, fps: 6 },
  special: { ...KODIK_MAIN, row: 7, frames: 6, fps: 9 },
};

function buildSheet(file: string): Record<PetAnim, SheetFrame> {
  const base = { src: u(`/pets/${file}`), cols: 1, rows: 10, frames: 1, fps: 1, cw: 288, ch: 312 };
  const row = (r: number, effect?: string): SheetFrame => ({ ...base, row: r, effect });
  const idle = row(0);
  const wave = row(3);
  const eat = row(4);
  const sleep = row(5);
  const play = row(6);
  const study = row(7);
  return {
    idle,
    'run-right': row(1),
    'run-left': row(2),
    wave,
    jump: row(9),
    failed: row(0, 'pet-sad'),
    waiting: sleep,
    working: study,
    review: wave,
    eat,
    sleep,
    play,
    study,
    pet: idle,
    beg: wave,
    special: row(8),
  };
}

export const PET_SHEETS: Record<PetType, Record<PetAnim, SheetFrame>> = {
  cat: KODIK,
  dog: buildSheet('dog-v2.webp'),
  bird: buildSheet('bird-v2.webp'),
  fox: buildSheet('fox-v2.webp'),
  dragon: buildSheet('dragon-v2.webp'),
  bunny: buildSheet('bunny-v2.webp'),
  panda: buildSheet('panda-v2.webp'),
  owl: buildSheet('owl-v2.webp'),
};

export const PET_ICONS: Record<PetType, string> = {
  cat: u('/pets/kodik-icon.png'),
  dog: u('/pets/dog-icon-v2.webp'),
  bird: u('/pets/bird-icon-v2.webp'),
  fox: u('/pets/fox-icon-v2.webp'),
  dragon: u('/pets/dragon-icon-v2.webp'),
  bunny: u('/pets/bunny-icon-v2.webp'),
  panda: u('/pets/panda-icon-v2.webp'),
  owl: u('/pets/owl-icon-v2.webp'),
};

export type ActionType = 'feed' | 'play' | 'train' | 'sleep' | 'heal' | null;

export const ACTION_ANIM: Record<Exclude<ActionType, null>, PetAnim> = {
  feed: 'eat',
  play: 'play',
  train: 'study',
  sleep: 'sleep',
  heal: 'wave',
};
