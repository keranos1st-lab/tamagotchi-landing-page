import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MemoryCategory = 'name' | 'goal' | 'preference' | 'other';

export interface MemoryItem {
  id: string;
  text: string;
  category: MemoryCategory;
  createdAt: number;
  updatedAt: number;
}

interface MemoryState {
  consent: boolean | null;
  items: MemoryItem[];
  pending: { id: string; text: string } | null;
  setConsent: (v: boolean) => void;
  add: (text: string, category?: MemoryCategory) => void;
  update: (id: string, text: string, category?: MemoryCategory) => void;
  remove: (id: string) => void;
  clear: () => void;
  propose: (text: string) => void;
  acceptPending: () => void;
  dismissPending: () => void;
}

export const MEMORY_LIMIT = 20;
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function guessCategory(text: string): MemoryCategory {
  const t = text.toLowerCase();
  if (/зовут|имя|называ/.test(t)) return 'name';
  if (/цель|хочет|учит|планир|мечта|стремит|готовит/.test(t)) return 'goal';
  if (/любит|нравит|предпочит|не любит|удобн/.test(t)) return 'preference';
  return 'other';
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
      consent: null,
      items: [],
      pending: null,
      setConsent: (v) => set(v ? { consent: true } : { consent: false, pending: null }),
      add: (text, category) => {
        const clean = text.trim().slice(0, 200);
        if (!clean) return;
        const exists = get().items.some((i) => i.text.toLowerCase() === clean.toLowerCase());
        if (exists) return;
        const now = Date.now();
        set((s) => ({ items: [...s.items, { id: uid(), text: clean, category: category ?? guessCategory(clean), createdAt: now, updatedAt: now }].slice(-MEMORY_LIMIT) }));
      },
      update: (id, text, category) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, text: text.trim().slice(0, 200) || i.text, category: category ?? i.category, updatedAt: Date.now() } : i)),
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [], pending: null }),
      propose: (text) => {
        const s = get();
        if (s.consent !== true) return;
        const clean = text.trim().slice(0, 200);
        if (!clean || s.items.some((i) => i.text.toLowerCase() === clean.toLowerCase())) return;
        set({ pending: { id: uid(), text: clean } });
      },
      acceptPending: () => {
        const p = get().pending;
        if (!p) return;
        get().add(p.text);
        set({ pending: null });
      },
      dismissPending: () => set({ pending: null }),
    }),
    { name: 'petagent-memory', version: 1 },
  ),
);
