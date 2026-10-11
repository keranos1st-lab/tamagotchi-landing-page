import { create } from 'zustand';
import { ackReminder, fetchDue, newRequestId, notifyNotesChanged, type Note, type NotesErr } from '@/utils/notesApi';

export type Fired = { note: Note; key: string };

interface ReminderState {
  queue: Fired[];
  busy: boolean;
  error: NotesErr | null;
  handled: Record<string, true>;
  poll: () => Promise<{ next: string | null } | null>;
  act: (mode: 'done' | 'snooze') => Promise<void>;
  clear: () => void;
}

const keyOf = (n: Note) => `${n.id}:${n.reminder?.seq ?? 0}`;

export const useReminderStore = create<ReminderState>()((set, get) => ({
  queue: [],
  busy: false,
  error: null,
  handled: {},
  clear: () => set({ queue: [], busy: false, error: null, handled: {} }),
  poll: async () => {
    const res = await fetchDue();
    if (!res.ok) return null;
    const s = get();
    const fresh = res.notes
      .filter((n) => n.reminder?.state === 'active')
      .map((n) => ({ note: n, key: keyOf(n) }))
      .filter((f) => !s.handled[f.key] && !s.queue.some((q) => q.key === f.key));
    const still = new Set(res.notes.map(keyOf));
    set({ queue: [...s.queue.filter((q) => still.has(q.key)), ...fresh] });
    return { next: res.next };
  },
  act: async (mode) => {
    const s = get();
    const head = s.queue[0];
    if (!head || s.busy) return;
    set({ busy: true, error: null });
    const res = await ackReminder({ id: head.note.id, seq: head.note.reminder?.seq ?? 0, mode, requestId: `ack-${head.key.replace(':', '-')}-${mode}-${newRequestId().slice(-6)}` });
    if (!res.ok) {
      set({ busy: false, error: res });
      return;
    }
    set((st) => ({
      busy: false,
      error: null,
      handled: { ...st.handled, [head.key]: true },
      queue: st.queue.filter((q) => q.key !== head.key),
    }));
    notifyNotesChanged();
  },
}));
