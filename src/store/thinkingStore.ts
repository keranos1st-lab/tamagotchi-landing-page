import { create } from 'zustand';

interface ThinkingState {
  thinking: boolean;
  setThinking: (v: boolean) => void;
}

export const useThinkingStore = create<ThinkingState>((set) => ({
  thinking: false,
  setThinking: (thinking) => set({ thinking }),
}));
