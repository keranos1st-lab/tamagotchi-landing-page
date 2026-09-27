import { create } from 'zustand';
import { fetchAiStatus, type AiStatus } from '@/utils/petAi';

interface AiStatusState {
  status: AiStatus | null | undefined;
  loading: boolean;
  refresh: () => Promise<void>;
  patch: (p: Partial<AiStatus>) => void;
}

let inflight: Promise<void> | null = null;

export const useAiStatusStore = create<AiStatusState>((set, get) => ({
  status: undefined,
  loading: false,
  refresh: () => {
    if (inflight) return inflight;
    set({ loading: true });
    inflight = fetchAiStatus()
      .then((status) => set({ status }))
      .finally(() => {
        set({ loading: false });
        inflight = null;
      });
    return inflight;
  },
  patch: (p) => {
    const s = get().status;
    set({ status: s ? { ...s, ...p } : ({ configured: true, ...p } as AiStatus) });
  },
}));

export function useAiStatus() {
  return useAiStatusStore((s) => s.status);
}
