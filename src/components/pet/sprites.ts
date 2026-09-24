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
  | 'review';

export const SHEET = {
  src: u('/pets/kodik.webp'),
  cols: 8,
  rows: 9,
  cellW: 192,
  cellH: 208,
};

export const SHEET_ROWS: Record<PetAnim, { row: number; frames: number; fps: number }> = {
  idle: { row: 0, frames: 6, fps: 6 },
  'run-right': { row: 1, frames: 8, fps: 12 },
  'run-left': { row: 2, frames: 8, fps: 12 },
  wave: { row: 3, frames: 4, fps: 6 },
  jump: { row: 4, frames: 5, fps: 9 },
  failed: { row: 5, frames: 8, fps: 8 },
  waiting: { row: 6, frames: 6, fps: 6 },
  working: { row: 7, frames: 6, fps: 9 },
  review: { row: 8, frames: 6, fps: 7 },
};

export const PET_IMAGES: Record<PetType, string | null> = {
  cat: null,
  dog: u('/pets/dog.webp'),
  bird: u('/pets/bird.webp'),
  fox: u('/pets/fox.webp'),
  dragon: u('/pets/dragon.webp'),
  bunny: u('/pets/bunny.webp'),
  panda: u('/pets/panda.webp'),
  owl: u('/pets/owl.webp'),
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
  feed: 'review',
  play: 'jump',
  train: 'working',
  sleep: 'waiting',
  heal: 'wave',
};
