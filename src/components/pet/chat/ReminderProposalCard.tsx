import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { usePetStore, type ChatMessage } from '@/store/petStore';
import { newRequestId, notifyNotesChanged, setReminder, type NotesErr } from '@/utils/notesApi';
import { openNotes } from '@/utils/notesApi';
import { openSettings } from '../account/AccountButton';

type Proposal = NonNullable<ChatMessage['reminderProposal']>;

export function ReminderProposalCard({ msgId, proposal }: { msgId: string; proposal: Proposal }) {
  const update = usePetStore((s) => s.updateChatMessage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<NotesErr | null>(null);
  const [requestId] = useState(newRequestId);
  const state = proposal.state ?? 'pending';

  const set = (next: Proposal['state']) => update(msgId, { reminderProposal: { ...proposal, state: next } });

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await setReminder({ id: proposal.noteId, reminder: { dueLocal: proposal.dueLocal, tz: proposal.tz, lead: proposal.lead }, requestId });
    setBusy(false);
    if (!res.ok) {
      setError(res);
      return;
    }
    set('saved');
    notifyNotesChanged();
  };

  if (state === 'saved') {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
        <Icon name="CircleCheck" size={14} />
        Напоминание сохранено: {proposal.when} ({proposal.tzLabel}), напомню {proposal.leadText}.
      </div>
    );
  }
  if (state === 'dismissed') {
    return <div className="mt-2 text-xs text-white/40">Напоминание не поставлено. Заметка сохранена как обычная.</div>;
  }

  return (
    <div className="mt-2 rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-200">
        <Icon name="BellRing" size={12} />
        Поставить напоминание?
      </div>
      <div className="mt-1 text-sm font-bold text-white">{proposal.when}</div>
      <div className="text-xs text-white/60">
        Часовой пояс: {proposal.tzLabel} · напомню {proposal.leadText}
      </div>
      {error && (
        <div role="alert" className="mt-2 rounded-lg border border-rose-400/25 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200">
          {error.message}
          {error.code === 'notes_login' && (
            <button onClick={() => openSettings('account')} className="ml-2 font-bold underline">
              Войти
            </button>
          )}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={confirm}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50"
        >
          <Icon name={busy ? 'Loader' : 'Check'} size={13} className={busy ? 'animate-spin' : ''} />
          {error?.retryable ? 'Повторить' : 'Поставить'}
        </button>
        <button onClick={openNotes} disabled={busy} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50">
          Изменить в блокноте
        </button>
        <button onClick={() => set('dismissed')} disabled={busy} className="rounded-lg px-3 py-1.5 text-xs font-bold text-white/55 hover:text-white disabled:opacity-50">
          Не нужно
        </button>
      </div>
    </div>
  );
}
