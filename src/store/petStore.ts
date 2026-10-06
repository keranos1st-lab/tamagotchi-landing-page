import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { track, useAchievementStore } from './achievementStore';

export type PetType = 'cat' | 'dog' | 'bird' | 'fox' | 'dragon' | 'bunny' | 'panda' | 'owl';

export type EvolutionStage = 'baby' | 'teen' | 'adult';

export type TextAction = 'explain' | 'shorten' | 'fix' | 'reply';

export interface ChatMessage {
  id: string;
  role: 'user' | 'pet';
  text: string;
  timestamp: number;
  kind?: 'ai' | 'error' | 'legacy' | 'task';
  declined?: boolean;
  searched?: boolean;
  verified?: boolean;
  asOf?: string;
  spoken?: string;
  sources?: { title: string; url: string; domain: string; date?: string }[];
  task?: { action: TextAction; source: string };
  error?: { code: string; message: string; retryable: boolean };
  retry?: { message: string; task?: { action: TextAction; source: string } };
}

const TICK_MS = 5000;
const RATE = { hunger: 0.3, happiness: 0.2, energy: 0.1 };
const ONLINE_WINDOW_MS = 60 * 1000;
const MAX_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000;
const OFFLINE_FACTOR = 0.04;
const OFFLINE_FLOOR = 15;

const XP_CAPS: Record<string, number> = {
  feed: 8,
  play: 8,
  train: 6,
  sleep: 4,
  heal: 4,
  pet: 25,
  chat: 15,
  help: 12,
};

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const ageMinutes = (bornAt: number, now = Date.now()) => Math.max(0, Math.floor((now - bornAt) / 60000));

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

  bornAt: number;
  xpLog: { day: string; counts: Record<string, number> };

  // Chat
  chatHistory: ChatMessage[];

  // Actions
  selectPet: (type: PetType, name: string) => void;
  feed: () => void;
  play: () => void;
  train: () => void;
  sleep: () => void;
  heal: () => void;
  pet: () => void;
  addChatMessage: (role: 'user' | 'pet', text: string, extra?: Partial<ChatMessage>) => string;
  updateChatMessage: (id: string, patch: Partial<ChatMessage>) => void;
  removeChatMessage: (id: string) => void;
  clearChat: () => void;
  advance: (now?: number) => void;
  gainExp: (amount: number) => void;
  earn: (source: string, base: number) => number;
  playedGame: (id: string, base: number) => number;
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
  bornAt: Date.now(),
  xpLog: { day: '', counts: {} },
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
      age: 0,
      bornAt: Date.now(),
      lastTick: Date.now(),
      lastPetted: Date.now(),
      lastInteraction: Date.now(),
      isAlive: true,
      levelUp: null,
      chatHistory: [],
      xpLog: { day: '', counts: {} },
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
    if (state.hunger < 90) get().earn('feed', 10);
  },

  pet: () => {
    const state = get();
    track.bump('pets');
    set({
      happiness: Math.min(100, state.happiness + 2),
      lastInteraction: Date.now(),
      lastPetted: Date.now(),
    });
    get().earn('pet', 1);
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
    get().earn('play', 15);
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
    get().earn('train', 20);
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
    if (state.energy < 80) get().earn('sleep', 5);
  },

  heal: () => {
    const state = get();
    track.bump('heal');
    set({
      health: Math.min(100, state.health + 30),
      lastInteraction: Date.now(),
    });
    if (state.health < 90) get().earn('heal', 5);
  },

  addChatMessage: (role, text, extra = {}) => {
    const id = uid();
    set((state) => ({
      chatHistory: [...state.chatHistory, { id, role, text, timestamp: Date.now(), ...extra }].slice(-80),
    }));
    return id;
  },

  updateChatMessage: (id, patch) =>
    set((state) => ({ chatHistory: state.chatHistory.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

  removeChatMessage: (id) => set((state) => ({ chatHistory: state.chatHistory.filter((m) => m.id !== id) })),

  clearChat: () => set({ chatHistory: [] }),

  advance: (now = Date.now()) => {
    const s = get();
    if (!s.hasSelectedPet) return set({ lastTick: now });
    const elapsed = Math.min(Math.max(0, now - s.lastTick), MAX_OFFLINE_MS);
    if (elapsed < 1000) return;
    const away = elapsed > ONLINE_WINDOW_MS;
    const online = away ? 0 : elapsed / TICK_MS;
    const offline = away ? elapsed / TICK_MS : 0;
    const floor = (start: number, v: number) => Math.min(start, Math.max(OFFLINE_FLOOR, v));
    let hunger = Math.max(0, s.hunger - RATE.hunger * online);
    let happiness = Math.max(0, s.happiness - RATE.happiness * online);
    let health = hunger < 20 || happiness < 20 ? Math.max(0, s.health - 0.1 * online) : s.health;
    if (offline > 0) {
      hunger = floor(hunger, hunger - RATE.hunger * OFFLINE_FACTOR * offline);
      happiness = floor(happiness, happiness - RATE.happiness * OFFLINE_FACTOR * offline);
      if (hunger <= OFFLINE_FLOOR || happiness <= OFFLINE_FLOOR) health = Math.min(health, Math.max(30, health - 0.02 * offline));
    }
    const energy = Math.min(100, s.energy + RATE.energy * (online + offline));
    set({ hunger, happiness, energy, health, age: ageMinutes(s.bornAt, now), lastTick: now });
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

  earn: (source, base) => {
    const s = get();
    const day = todayKey();
    const log = s.xpLog?.day === day ? s.xpLog : { day, counts: {} };
    const n = log.counts[source] ?? 0;
    const cap = XP_CAPS[source] ?? (source.startsWith('game:') ? 5 : 10);
    const mult = n < cap ? 1 : n < cap * 2 ? 0.3 : 0;
    const amount = Math.round(base * mult);
    set({ xpLog: { day, counts: { ...log.counts, [source]: n + 1 } } });
    if (amount > 0) get().gainExp(amount);
    return base > 0 && amount === 0 ? -1 : amount;
  },

  playedGame: (id, base) => {
    const s = get();
    set({
      happiness: Math.min(100, s.happiness + 8),
      energy: Math.max(0, s.energy - 8),
      hunger: Math.max(0, s.hunger - 4),
      lastInteraction: Date.now(),
    });
    return get().earn(`game:${id}`, Math.max(0, Math.round(base)));
  },

  resetPet: () => set({ hasSelectedPet: false, levelUp: null }),
    }),
    {
      name: 'petagent-save',
      version: 2,
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2) {
          const age = typeof p.age === 'number' ? p.age : 0;
          p.bornAt = Date.now() - age * 60000;
          p.xpLog = { day: '', counts: {} };
          const hist = Array.isArray(p.chatHistory) ? (p.chatHistory as ChatMessage[]) : [];
          p.chatHistory = hist.map((m, i) => ({
            ...m,
            id: m.id ?? `legacy-${i}`,
            kind: m.role === 'pet' ? 'legacy' : m.kind,
          }));
        }
        return p as unknown as PetState;
      },
      partialize: (s) => {
        const { chatHistory, levelUp: _lu, ...rest } = s;
        void _lu;
        return { ...rest, chatHistory: chatHistory.slice(-60) };
      },
    },
  ),
);
