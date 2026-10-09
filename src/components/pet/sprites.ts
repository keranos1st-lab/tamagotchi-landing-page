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
  | 'special'
  | 'flap'
  | 'trick';

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
  loopFrom?: number;
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
  play: { src: u('/pets/cat-play.webp'), cols: 12, rows: 1, row: 0, frames: 12, fps: 7, cw: 322, ch: 313 },
  study: { ...KODIK_CARE, row: 3, frames: 4, fps: 4 },
  pet: { ...KODIK_MAIN, row: 0, frames: 1, fps: 1 },
  beg: { ...KODIK_MAIN, row: 0, frames: 6, fps: 6 },
  special: { ...KODIK_MAIN, row: 7, frames: 6, fps: 9 },
  flap: { ...KODIK_MAIN, row: 7, frames: 6, fps: 9 },
  trick: { src: u('/pets/cat-laptop.webp'), cols: 8, rows: 1, row: 0, frames: 8, fps: 10, cw: 384, ch: 416 },
};

function buildSheet(file: string, trickFps = 14): Record<PetAnim, SheetFrame> {
  const base = { src: u(`/pets/${file}`), cols: 4, rows: 8 };
  const idle = { ...base, row: 0, frames: 4, fps: 4 };
  const wave = { ...base, row: 3, frames: 4, fps: 9 };
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
    pet: { ...idle, frames: 1, fps: 1 },
    beg: idle,
    special: { ...play, fps: 8 },
    flap: wave,
    trick: { src: u(`/pets/${file.replace('-sheet', '-trick')}`), cols: 8, rows: 1, row: 0, frames: 8, fps: trickFps },
  };
}

const ALPACA_BASE = { src: u('/pets/alpaca-sheet.webp'), cols: 4, rows: 10, cw: 216, ch: 216 };
const alp = (row: number, fps: number): SheetFrame => ({ ...ALPACA_BASE, row, frames: 4, fps });

const ALPACA: Record<PetAnim, SheetFrame> = {
  idle: alp(0, 4),
  'run-right': alp(1, 8),
  'run-left': alp(9, 8),
  wave: alp(6, 9),
  jump: alp(4, 6),
  failed: alp(7, 3),
  waiting: alp(3, 3),
  working: alp(5, 4),
  review: alp(6, 9),
  eat: alp(2, 5),
  sleep: alp(3, 3),
  play: alp(4, 6),
  study: alp(5, 4),
  pet: alp(6, 5),
  beg: alp(0, 4),
  special: alp(8, 7),
  flap: alp(6, 9),
  trick: alp(8, 6),
};

const FOX_BASE = { src: u('/pets/fox-sheet.webp'), cols: 4, rows: 10, cw: 232, ch: 180 };
const FOX_SLEEP: SheetFrame = { src: u('/pets/fox-sleep.webp'), cols: 8, rows: 1, row: 0, frames: 8, fps: 3, cw: 232, ch: 180, loopFrom: 4 };
const FOX_PLAY: SheetFrame = { src: u('/pets/fox-play.webp'), cols: 8, rows: 1, row: 0, frames: 8, fps: 6, cw: 232, ch: 180 };
const FOX_SAD: SheetFrame = { src: u('/pets/fox-sad.webp'), cols: 8, rows: 1, row: 0, frames: 8, fps: 5, cw: 232, ch: 180, loopFrom: 5 };
const FOX_PET: SheetFrame = { src: u('/pets/fox-pet.webp'), cols: 8, rows: 1, row: 0, frames: 8, fps: 8, cw: 232, ch: 180 };
const FOX_TRICK: SheetFrame = { src: u('/pets/fox-trick.webp'), cols: 8, rows: 1, row: 0, frames: 8, fps: 7, cw: 232, ch: 180 };
const FOX_IDLE: SheetFrame = { src: u('/pets/fox-idle.webp'), cols: 8, rows: 1, row: 0, frames: 8, fps: 4, cw: 232, ch: 180 };
const FOX_WALK = { src: u('/pets/fox-walk.webp'), cols: 8, rows: 2, cw: 232, ch: 180 };
const fx = (row: number, fps: number): SheetFrame => ({ ...FOX_BASE, row, frames: 4, fps });

const FOX: Record<PetAnim, SheetFrame> = {
  idle: FOX_IDLE,
  'run-right': { ...FOX_WALK, row: 0, frames: 8, fps: 12 },
  'run-left': { ...FOX_WALK, row: 1, frames: 8, fps: 12 },
  wave: fx(6, 9),
  jump: FOX_PLAY,
  failed: FOX_SAD,
  waiting: FOX_SLEEP,
  working: { src: u('/pets/fox-study.webp'), cols: 8, rows: 1, row: 0, frames: 8, fps: 5, cw: 232, ch: 180 },
  review: fx(6, 9),
  eat: { src: u('/pets/fox-eat.webp'), cols: 8, rows: 1, row: 0, frames: 8, fps: 6, cw: 232, ch: 180 },
  sleep: FOX_SLEEP,
  play: FOX_PLAY,
  study: { src: u('/pets/fox-study.webp'), cols: 8, rows: 1, row: 0, frames: 8, fps: 5, cw: 232, ch: 180 },
  pet: FOX_PET,
  beg: FOX_IDLE,
  special: FOX_TRICK,
  flap: fx(6, 9),
  trick: FOX_TRICK,
};

export const PET_SHEETS: Record<PetType, Record<PetAnim, SheetFrame>> = {
  cat: KODIK,
  dog: ALPACA,
  bird: buildSheet('bird-sheet.webp'),
  fox: FOX,
  dragon: {
    ...buildSheet('dragon-sheet.webp'),
    flap: { src: u('/pets/dragon-flap.webp'), cols: 8, rows: 1, row: 0, frames: 8, fps: 16 },
  },
  bunny: buildSheet('bunny-sheet.webp'),
  panda: buildSheet('panda-sheet.webp'),
  owl: buildSheet('owl-sheet.webp'),
};

export const PET_ICONS: Record<PetType, string> = {
  cat: u('/pets/kodik-icon.png'),
  dog: u('/pets/alpaca.webp'),
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
