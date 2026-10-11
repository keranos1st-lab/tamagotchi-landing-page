import { create } from 'zustand';
import { newRequestId, NOTE_MAX, saveNote, type Note, type NotesErr } from '@/utils/notesApi';

interface DraftState {
  active: boolean;
  id: number | null;
  version: number | null;
  text: string;
  requestId: string;
  saving: boolean;
  error: NotesErr | null;
  begin: (note: Note | null) => void;
  setText: (text: string) => void;
  discard: () => void;
  save: () => Promise<Note | null>;
}

export const useNoteDraft = create<DraftState>()((set, get) => ({
  active: false,
  id: null,
  version: null,
  text: '',
  requestId: '',
  saving: false,
  error: null,
  begin: (note) => {
    const s = get();
    if (s.active && s.id === (note?.id ?? null)) return;
    set({ active: true, id: note?.id ?? null, version: note?.version ?? null, text: note?.text ?? '', requestId: newRequestId(), saving: false, error: null });
  },
  setText: (text) => set({ text: text.slice(0, NOTE_MAX), requestId: newRequestId(), error: null }),
  discard: () => set({ active: false, id: null, version: null, text: '', requestId: '', saving: false, error: null }),
  save: async () => {
    const s = get();
    if (s.saving) return null;
    const text = s.text.trim();
    if (!text) {
      set({ error: { ok: false, code: 'notes_empty', message: 'Напиши текст заметки.', retryable: false, status: 400 } });
      return null;
    }
    set({ saving: true, error: null });
    const res = await saveNote({ id: s.id, text, expectedVersion: s.version, requestId: s.requestId });
    if (!res.ok) {
      set({ saving: false, error: res });
      return null;
    }
    set({ active: false, id: null, version: null, text: '', requestId: '', saving: false, error: null });
    return res.note;
  },
}));
