import { create } from 'zustand';
import {
  defaultDueLocal,
  newRequestId,
  NOTE_MAX,
  saveNote,
  userTimezone,
  type Lead,
  type Note,
  type NotesErr,
  type ReminderInput,
} from '@/utils/notesApi';

interface DraftState {
  active: boolean;
  id: number | null;
  version: number | null;
  text: string;
  remindOn: boolean;
  remindTouched: boolean;
  dueLocal: string;
  tz: string;
  lead: Lead;
  requestId: string;
  saving: boolean;
  error: NotesErr | null;
  begin: (note: Note | null, preset?: { dueLocal: string; tz: string; lead: Lead } | null) => void;
  setText: (text: string) => void;
  setRemindOn: (on: boolean) => void;
  setDue: (dueLocal: string) => void;
  setLead: (lead: Lead) => void;
  discard: () => void;
  save: () => Promise<Note | null>;
}

const blank = {
  active: false,
  id: null as number | null,
  version: null as number | null,
  text: '',
  remindOn: false,
  remindTouched: false,
  dueLocal: '',
  tz: '',
  lead: 15 as Lead,
  requestId: '',
  saving: false,
  error: null as NotesErr | null,
};

export const useNoteDraft = create<DraftState>()((set, get) => ({
  ...blank,
  begin: (note, preset) => {
    const s = get();
    if (s.active && s.id === (note?.id ?? null)) return;
    const r = note?.reminder && note.reminder.state === 'active' ? note.reminder : null;
    set({
      ...blank,
      active: true,
      id: note?.id ?? null,
      version: note?.version ?? null,
      text: note?.text ?? '',
      remindOn: !!r || !!preset,
      dueLocal: r?.dueLocal ?? preset?.dueLocal ?? defaultDueLocal(),
      tz: r?.tz ?? preset?.tz ?? userTimezone(),
      lead: r?.lead ?? preset?.lead ?? 15,
      remindTouched: !!preset,
      requestId: newRequestId(),
    });
  },
  setText: (text) => set({ text: text.slice(0, NOTE_MAX), requestId: newRequestId(), error: null }),
  setRemindOn: (remindOn) => set({ remindOn, remindTouched: true, tz: userTimezone(), requestId: newRequestId(), error: null }),
  setDue: (dueLocal) => set({ dueLocal, remindTouched: true, remindOn: true, tz: userTimezone(), requestId: newRequestId(), error: null }),
  setLead: (lead) => set({ lead, remindTouched: true, remindOn: true, requestId: newRequestId(), error: null }),
  discard: () => set({ ...blank }),
  save: async () => {
    const s = get();
    if (s.saving) return null;
    const text = s.text.trim();
    if (!text) {
      set({ error: { ok: false, code: 'notes_empty', message: 'Напиши текст заметки.', retryable: false, status: 400 } });
      return null;
    }
    let reminder: ReminderInput | null | undefined;
    if (s.remindTouched) {
      if (s.remindOn) {
        if (!s.dueLocal) {
          set({ error: { ok: false, code: 'reminder_bad', message: 'Укажи дату и время напоминания.', retryable: false, status: 400 } });
          return null;
        }
        reminder = { dueLocal: s.dueLocal, tz: s.tz || userTimezone(), lead: s.lead };
      } else {
        reminder = null;
      }
    }
    set({ saving: true, error: null });
    const res = await saveNote({ id: s.id, text, expectedVersion: s.version, requestId: s.requestId, reminder });
    if (!res.ok) {
      set({ saving: false, error: res });
      return null;
    }
    set({ ...blank });
    return res.note;
  },
}));
