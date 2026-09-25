import { create } from 'zustand';

interface ThinkingState {
  thinking: boolean;
  celebrate: number;
  setThinking: (v: boolean) => void;
  cheer: () => void;
}

export const useThinkingStore = create<ThinkingState>((set) => ({
  thinking: false,
  celebrate: 0,
  setThinking: (thinking) => set({ thinking }),
  cheer: () => set({ celebrate: Date.now() }),
}));
