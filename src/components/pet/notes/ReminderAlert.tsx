import { useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { usePetStore } from '@/store/petStore';
import { useReminderStore } from '@/store/reminderStore';
import { formatDue } from '@/utils/notesApi';
import { PetSprite } from '../PetSprite';
import { openSettings } from '../account/AccountButton';
import { useReminders } from './useReminders';

export function ReminderAlert() {
  useReminders();
  const head = useReminderStore((s) => s.queue[0]);
  const more = useReminderStore((s) => Math.max(0, s.queue.length - 1));
  const busy = useReminderStore((s) => s.busy);
  const error = useReminderStore((s) => s.error);
  const act = useReminderStore((s) => s.act);
  const type = usePetStore((s) => s.type);
  const name = usePetStore((s) => s.name);

  useEffect(() => {
    if (!head) return;
    const original = document.title;
    let on = false;
    const id = setInterval(() => {
      document.title = on ? original : `🔔 ${name} напоминает`;
      on = !on;
    }, 1000);
    return () => {
      clearInterval(id);
      document.title = original;
    };
  }, [head, name]);

  if (!head) return null;
  const r = head.note.reminder;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3 sm:bottom-6 sm:left-auto sm:right-6 sm:justify-end sm:p-0" role="alertdialog" aria-live="assertive" aria-label="Напоминание">
      <div className="pointer-events-auto pa-pop w-full max-w-sm overflow-hidden rounded-3xl border border-amber-300/30 bg-[#17122f]/95 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] backdrop-blur">
        <div className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-amber-400/20 to-pink-500/10 px-4 py-3">
          <div className="-my-2 shrink-0">
            <PetSprite type={type} anim="wave" size={64} shadow={false} fx={false} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-200">
              <Icon name="BellRing" size={12} className="animate-pulse" />
              {name} напоминает
            </div>
            {r && <div className="truncate text-xs text-white/55">{formatDue(r)}</div>}
          </div>
          {more > 0 && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/70">ещё {more}</span>}
        </div>
        <div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 text-sm leading-relaxed text-white">{head.note.text}</div>
        {error && (
          <div role="alert" className="mx-4 mb-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error.message}
            {error.code === 'notes_login' && (
              <button onClick={() => openSettings('account')} className="ml-2 font-bold underline">
                Войти
              </button>
            )}
          </div>
        )}
        <div className="flex gap-2 border-t border-white/10 p-3">
          <button
            onClick={() => act('snooze')}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            Отложить на 15 минут
          </button>
          <button
            onClick={() => act('done')}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-extrabold text-white shadow-[0_8px_24px_-8px_rgba(236,72,153,0.7)] transition disabled:opacity-50"
          >
            <Icon name={busy ? 'Loader' : 'Check'} size={15} className={busy ? 'animate-spin' : ''} />
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
