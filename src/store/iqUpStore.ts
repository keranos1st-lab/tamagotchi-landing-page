import { create } from 'zustand';
import type { IqLevel } from '@/components/pet/iq';

interface IqUpState {
  event: { id: number; level: IqLevel; iq: number } | null;
  fire: (level: IqLevel, iq: number) => void;
  clear: () => void;
}

export const useIqUpStore = create<IqUpState>((set) => ({
  event: null,
  fire: (level, iq) => set({ event: { id: Date.now(), level, iq } }),
  clear: () => set({ event: null }),
}));
