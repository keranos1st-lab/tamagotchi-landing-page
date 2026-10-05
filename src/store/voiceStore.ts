import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type VoiceStatus = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

interface VoiceState {
  status: VoiceStatus;
  level: number;
  heard: string;
  reply: string;
  note: string | null;
  speakReplies: boolean;
  set: (p: Partial<Omit<VoiceState, 'set' | 'setSpeakReplies'>>) => void;
  setSpeakReplies: (v: boolean) => void;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      status: 'idle',
      level: 0,
      heard: '',
      reply: '',
      note: null,
      speakReplies: false,
      set: (p) => set(p),
      setSpeakReplies: (speakReplies) => set({ speakReplies }),
    }),
    { name: 'petagent-voice', partialize: (s) => ({ speakReplies: s.speakReplies }) },
  ),
);

export const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: '',
  listening: 'Слушаю…',
  transcribing: 'Распознаю…',
  thinking: 'Думаю…',
  speaking: 'Говорю…',
};
