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
  | 'study';

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
}

const KODIK_MAIN = { src: u('/pets/kodik.webp'), cols: 8, rows: 9 };
const KODIK_CARE = { src: u('/pets/kodik-care.webp'), cols: 4, rows: 4 };

const KODIK: Record<PetAnim, SheetFrame> = {
  idle: { ...KODIK_MAIN, row: 0, frames: 6, fps: 6 },
  'run-right': { ...KODIK_MAIN, row: 1, frames: 8, fps: 12 },
  'run-left': { ...KODIK_MAIN, row: 2, frames: 8, fps: 12 },
  wave: { ...KODIK_MAIN, row: 3, frames: 4, fps: 6 },
  jump: { ...KODIK_MAIN, row: 4, frames: 5, fps: 9 },
  failed: { ...KODIK_MAIN, row: 5, frames: 8, fps: 8 },
  waiting: { ...KODIK_MAIN, row: 6, frames: 6, fps: 6 },
  working: { ...KODIK_MAIN, row: 7, frames: 6, fps: 9 },
  review: { ...KODIK_MAIN, row: 8, frames: 6, fps: 7 },
  eat: { ...KODIK_CARE, row: 0, frames: 4, fps: 5 },
  sleep: { ...KODIK_CARE, row: 1, frames: 4, fps: 3 },
  play: { ...KODIK_CARE, row: 2, frames: 4, fps: 6 },
  study: { ...KODIK_CARE, row: 3, frames: 4, fps: 4 },
};

function buildSheet(file: string): Record<PetAnim, SheetFrame> {
  const base = { src: u(`/pets/${file}`), cols: 4, rows: 8 };
  const idle = { ...base, row: 0, frames: 4, fps: 4 };
  const wave = { ...base, row: 3, frames: 4, fps: 6 };
  const eat = { ...base, row: 4, frames: 4, fps: 5 };
  const sleep = { ...base, row: 5, frames: 4, fps: 3 };
  const play = { ...base, row: 6, frames: 4, fps: 6 };
  const study = { ...base, row: 7, frames: 4, fps: 4 };
  return {
    idle,
    'run-right': { ...base, row: 1, frames: 4, fps: 8 },
    'run-left': { ...base, row: 2, frames: 4, fps: 8 },
    wave,
    jump: play,
    failed: { ...idle, fps: 2, effect: 'pet-sad' },
    waiting: sleep,
    working: study,
    review: wave,
    eat,
    sleep,
    play,
    study,
  };
}

export const PET_SHEETS: Record<PetType, Record<PetAnim, SheetFrame>> = {
  cat: KODIK,
  dog: buildSheet('dog-sheet.webp'),
  bird: buildSheet('bird-sheet.webp'),
  fox: buildSheet('fox-sheet.webp'),
  dragon: buildSheet('dragon-sheet.webp'),
  bunny: buildSheet('bunny-sheet.webp'),
  panda: buildSheet('panda-sheet.webp'),
  owl: buildSheet('owl-sheet.webp'),
};

export const PET_ICONS: Record<PetType, string> = {
  cat: u('/pets/kodik-icon.png'),
  dog: u('/pets/dog.webp'),
  bird: u('/pets/bird.webp'),
  fox: u('/pets/fox.webp'),
  dragon: u('/pets/dragon.webp'),
  bunny: u('/pets/bunny.webp'),
  panda: u('/pets/panda.webp'),
  owl: u('/pets/owl.webp'),
};

export type ActionType = 'feed' | 'play' | 'train' | 'sleep' | 'heal' | null;

export const ACTION_ANIM: Record<Exclude<ActionType, null>, PetAnim> = {
  feed: 'eat',
  play: 'play',
  train: 'study',
  sleep: 'sleep',
  heal: 'wave',
};
