import { create } from 'zustand';

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
  addChatMessage: (role: 'user' | 'pet', text: string) => void;
  tick: () => void;
  gainExp: (amount: number) => void;
}

const PET_NAMES: Record<PetType, string> = {
  cat: 'Котик',
  dog: 'Собачка',
  bird: 'Птичка',
  fox: 'Лисичка',
  dragon: 'Дракончик',
  bunny: 'Зайчик',
  panda: 'Панда',
  owl: 'Сова',
};

export { PET_NAMES };

export const usePetStore = create<PetState>((set, get) => ({
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
    set({
      hunger: Math.min(100, state.hunger + 25),
      happiness: Math.min(100, state.happiness + 5),
      energy: Math.max(0, state.energy - 5),
      lastInteraction: Date.now(),
    });
    get().gainExp(10);
  },

  play: () => {
    const state = get();
    if (state.energy < 15) return;
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

    const timeSinceInteraction = (Date.now() - state.lastInteraction) / 1000 / 60; // minutes

    set({
      hunger: Math.max(0, state.hunger - 0.3),
      happiness: Math.max(0, state.happiness - 0.2),
      energy: Math.min(100, state.energy + 0.1),
      age: state.age + 1,
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
    });
  },
}));
