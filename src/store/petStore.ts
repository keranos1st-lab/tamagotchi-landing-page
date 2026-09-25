import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { track, useAchievementStore } from './achievementStore';

export type PetType = 'cat' | 'dog' | 'bird' | 'fox' | 'dragon' | 'bunny' | 'panda' | 'owl';

export type EvolutionStage = 'baby' | 'teen' | 'adult';

export interface PetState {
  // Pet info
  name: string;
  type: PetType;
  level: number;
  exp: number;
  expToNext: number;
  stage: EvolutionStage;

  // Stats (0-100)
  hunger: number;
  happiness: number;
  energy: number;
  health: number;
  intelligence: number;

  // Meta
  age: number; // in minutes
  isAlive: boolean;
  hasSelectedPet: boolean;
  lastInteraction: number;

  // Chat
  chatHistory: { role: 'user' | 'pet'; text: string; timestamp: number }[];

  // Actions
  selectPet: (type: PetType, name: string) => void;
  feed: () => void;
  play: () => void;
  train: () => void;
  sleep: () => void;
  heal: () => void;
  pet: () => void;
  addChatMessage: (role: 'user' | 'pet', text: string) => void;
  tick: () => void;
  gainExp: (amount: number) => void;
  catchUp: () => void;
  resetPet: () => void;
  lastTick: number;
  lastPetted: number;
  levelUp: { from: number; to: number; stageFrom: EvolutionStage; stageTo: EvolutionStage; id: number } | null;
  clearLevelUp: () => void;
}

const PET_NAMES: Record<PetType, string> = {
  cat: 'Кодик',
  dog: 'Собачка',
  bird: 'Птичка',
  fox: 'Лисичка',
  dragon: 'Дракончик',
  bunny: 'Зайчик',
  panda: 'Панда',
  owl: 'Сова',
};

export { PET_NAMES };

export const usePetStore = create<PetState>()(
  persist(
    (set, get) => ({
  lastTick: Date.now(),
  lastPetted: Date.now(),
  levelUp: null,
  clearLevelUp: () => set({ levelUp: null }),
  name: '',
  type: 'cat',
  level: 1,
  exp: 0,
  expToNext: 100,
  stage: 'baby',
  hunger: 80,
  happiness: 80,
  energy: 80,
  health: 100,
  intelligence: 10,
  age: 0,
  isAlive: true,
  hasSelectedPet: false,
  lastInteraction: Date.now(),
  chatHistory: [],

  selectPet: (type, name) => {
    useAchievementStore.getState().markPet(type);
    set({
      type,
      name,
      hasSelectedPet: true,
      hunger: 80,
      happiness: 80,
      energy: 80,
      health: 100,
      intelligence: 10,
      level: 1,
      exp: 0,
      expToNext: 100,
      stage: 'baby',
      lastInteraction: Date.now(),
    });
  },

  feed: () => {
    const state = get();
    if (state.energy < 5) return;
    track.bump('feed');
    set({
      hunger: Math.min(100, state.hunger + 25),
      happiness: Math.min(100, state.happiness + 5),
      energy: Math.max(0, state.energy - 5),
      lastInteraction: Date.now(),
    });
    get().gainExp(10);
  },

  pet: () => {
    const state = get();
    track.bump('pets');
    set({
      happiness: Math.min(100, state.happiness + 2),
      lastInteraction: Date.now(),
      lastPetted: Date.now(),
    });
    get().gainExp(1);
  },

  play: () => {
    const state = get();
    if (state.energy < 15) return;
    track.bump('play');
    set({
      happiness: Math.min(100, state.happiness + 30),
      energy: Math.max(0, state.energy - 20),
      hunger: Math.max(0, state.hunger - 10),
      lastInteraction: Date.now(),
    });
    get().gainExp(15);
  },

  train: () => {
    const state = get();
    if (state.energy < 20) return;
    track.bump('train');
    set({
      intelligence: Math.min(100, state.intelligence + 5),
      energy: Math.max(0, state.energy - 25),
      hunger: Math.max(0, state.hunger - 15),
      happiness: Math.max(0, state.happiness - 5),
      lastInteraction: Date.now(),
    });
    get().gainExp(25);
  },

  sleep: () => {
    const state = get();
    track.bump('sleep');
    set({
      energy: Math.min(100, state.energy + 50),
      health: Math.min(100, state.health + 10),
      hunger: Math.max(0, state.hunger - 10),
      lastInteraction: Date.now(),
    });
    get().gainExp(5);
  },

  heal: () => {
    const state = get();
    track.bump('heal');
    set({
      health: Math.min(100, state.health + 30),
      lastInteraction: Date.now(),
    });
    get().gainExp(5);
  },

  addChatMessage: (role, text) => {
    set((state) => ({
      chatHistory: [...state.chatHistory, { role, text, timestamp: Date.now() }],
    }));
  },

  tick: () => {
    const state = get();
    if (!state.hasSelectedPet) return;

    set({
      hunger: Math.max(0, state.hunger - 0.3),
      happiness: Math.max(0, state.happiness - 0.2),
      energy: Math.min(100, state.energy + 0.1),
      age: state.age + 1,
      lastTick: Date.now(),
    });

    // Health decreases if hunger or happiness is very low
    if (state.hunger < 20 || state.happiness < 20) {
      set({ health: Math.max(0, state.health - 0.5) });
    }

    if (state.health <= 0) {
      set({ isAlive: false });
    }
  },

  gainExp: (amount) => {
    const state = get();
    let newExp = state.exp + amount;
    let newLevel = state.level;
    let newExpToNext = state.expToNext;

    while (newExp >= newExpToNext) {
      newExp -= newExpToNext;
      newLevel++;
      newExpToNext = Math.floor(newExpToNext * 1.5);
    }

    // Calculate evolution stage
    let newStage: EvolutionStage = 'baby';
    if (newLevel >= 10) {
      newStage = 'adult';
    } else if (newLevel >= 5) {
      newStage = 'teen';
    }

    set({
      exp: newExp,
      level: newLevel,
      expToNext: newExpToNext,
      stage: newStage,
      ...(newLevel > state.level
        ? {
            levelUp: {
              from: state.levelUp?.from ?? state.level,
              to: newLevel,
              stageFrom: state.levelUp?.stageFrom ?? state.stage,
              stageTo: newStage,
              id: Date.now(),
            },
          }
        : {}),
    });
  },

  catchUp: () => {
    const s = get();
    if (!s.hasSelectedPet) return set({ lastTick: Date.now() });
    const ticks = Math.min(Math.floor((Date.now() - s.lastTick) / 5000), 12 * 60 * 6);
    if (ticks <= 0) return;
    const hunger = Math.max(0, s.hunger - 0.3 * ticks * 0.5);
    const happiness = Math.max(0, s.happiness - 0.2 * ticks * 0.5);
    const energy = Math.min(100, s.energy + 0.1 * ticks);
    const starving = hunger < 20 || happiness < 20;
    const health = starving ? Math.max(5, s.health - 0.1 * ticks) : s.health;
    set({ hunger, happiness, energy, health, age: s.age + Math.floor(ticks / 12), lastTick: Date.now() });
  },

  resetPet: () => set({ hasSelectedPet: false, chatHistory: [], isAlive: true, age: 0 }),
    }),
    {
      name: 'petagent-save',
      version: 1,
      partialize: (s) => {
        const { chatHistory, levelUp: _lu, ...rest } = s;
        void _lu;
        return { ...rest, chatHistory: chatHistory.slice(-50) };
      },
    },
  ),
);
