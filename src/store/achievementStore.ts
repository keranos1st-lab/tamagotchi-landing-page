import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Counter =
  | 'feed'
  | 'play'
  | 'train'
  | 'sleep'
  | 'heal'
  | 'pets'
  | 'chat'
  | 'tricks'
  | 'games'
  | 'gameWins'
  | 'quizPerfect'
  | 'tttWins'
  | 'catchBest'
  | 'tetrisLinesBest'
  | 'snakeBest'
  | 'reactionBest'
  | 'nightVisits'
  | 'morningVisits';

interface AchievementState {
  counters: Partial<Record<Counter, number>>;
  gamesPlayed: string[];
  petsOwned: string[];
  days: string[];
  unlocked: Record<string, number>;
  queue: string[];
  bump: (c: Counter, by?: number) => void;
  best: (c: Counter, value: number, lowerIsBetter?: boolean) => void;
  markGame: (id: string) => void;
  markPet: (type: string) => void;
  markVisit: () => void;
  unlock: (id: string) => void;
  shift: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      counters: {},
      gamesPlayed: [],
      petsOwned: [],
      days: [],
      unlocked: {},
      queue: [],
      bump: (c, by = 1) => set((s) => ({ counters: { ...s.counters, [c]: (s.counters[c] ?? 0) + by } })),
      best: (c, value, lowerIsBetter = false) =>
        set((s) => {
          const cur = s.counters[c];
          const better = cur === undefined || (lowerIsBetter ? value < cur : value > cur);
          return better ? { counters: { ...s.counters, [c]: value } } : {};
        }),
      markGame: (id) => set((s) => (s.gamesPlayed.includes(id) ? {} : { gamesPlayed: [...s.gamesPlayed, id] })),
      markPet: (type) => set((s) => (s.petsOwned.includes(type) ? {} : { petsOwned: [...s.petsOwned, type] })),
      markVisit: () => {
        const d = today();
        const h = new Date().getHours();
        const s = get();
        const patch: Partial<AchievementState> = {};
        if (!s.days.includes(d)) patch.days = [...s.days, d].slice(-60);
        const counters = { ...s.counters };
        if (h >= 0 && h < 5) counters.nightVisits = (counters.nightVisits ?? 0) + 1;
        if (h >= 5 && h < 8) counters.morningVisits = (counters.morningVisits ?? 0) + 1;
        set({ ...patch, counters });
      },
      unlock: (id) =>
        set((s) => (s.unlocked[id] ? {} : { unlocked: { ...s.unlocked, [id]: Date.now() }, queue: [...s.queue, id] })),
      shift: () => set((s) => ({ queue: s.queue.slice(1) })),
    }),
    {
      name: 'petagent-achievements',
      version: 1,
      partialize: (s) => {
        const { queue: _q, ...rest } = s;
        void _q;
        return rest;
      },
    },
  ),
);

export function streak(days: string[]): number {
  if (!days.length) return 0;
  const set = new Set(days);
  let n = 0;
  const d = new Date();
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export const track = {
  bump: (c: Counter, by?: number) => useAchievementStore.getState().bump(c, by),
  best: (c: Counter, v: number, lower?: boolean) => useAchievementStore.getState().best(c, v, lower),
  game: (id: string) => {
    const s = useAchievementStore.getState();
    s.markGame(id);
    s.bump('games');
  },
  win: () => useAchievementStore.getState().bump('gameWins'),
};
