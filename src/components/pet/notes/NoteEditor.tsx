import { useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { useNoteDraft } from '@/store/noteDraftStore';
import { NOTE_MAX, REMINDER_PRESETS, type Note } from '@/utils/notesApi';
import { openSettings } from '../account/AccountButton';

export function NoteEditor({ onSaved, onCancel }: { onSaved: (note: Note) => void; onCancel: () => void }) {
  const { text, id, saving, error, remindOn, dueLocal, lead, tz, setText, setRemindOn, setDue, setLead, save } = useNoteDraft();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = async () => {
    const note = await save();
    if (note) onSaved(note);
  };

  const [datePart = '', timePart = ''] = dueLocal.split('T');
  const setDatePart = (v: string) => v && setDue(`${v}T${timePart || '09:00'}`);
  const setTimePart = (v: string) => v && setDue(`${datePart || new Date().toISOString().slice(0, 10)}T${v}`);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-white/45">{id ? `Заметка №${id}` : 'Новая заметка'}</div>
      <textarea
        ref={ref}
        value={text}
        disabled={saving}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit();
        }}
        placeholder="Что записать?"
        rows={6}
        className="min-h-[120px] w-full flex-1 resize-none rounded-2xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-pink-300/50 focus:outline-none disabled:opacity-60"
      />
      <div className="text-right text-[11px] text-white/40">
        {text.length} / {NOTE_MAX}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Icon name="BellRing" size={15} className="text-amber-300" />
            Напоминание
          </div>
          <button
            onClick={() => setRemindOn(!remindOn)}
            role="switch"
            aria-checked={remindOn}
            aria-label="Напоминание"
            disabled={saving}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${remindOn ? 'bg-gradient-to-r from-violet-500 to-pink-500' : 'bg-white/15'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${remindOn ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        {!remindOn && <div className="mt-1 text-xs text-white/45">Без даты и времени это обычная заметка.</div>}
        {remindOn && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/45">
                Дата
                <input
                  type="date"
                  aria-label="Дата напоминания"
                  value={datePart}
                  disabled={saving}
                  onChange={(e) => setDatePart(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-2.5 py-2 text-sm font-normal normal-case tracking-normal text-white [color-scheme:dark] focus:border-pink-300/50 focus:outline-none"
                />
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/45">
                Время
                <input
                  type="time"
                  aria-label="Время напоминания"
                  value={timePart}
                  disabled={saving}
                  onChange={(e) => setTimePart(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-2.5 py-2 text-sm font-normal normal-case tracking-normal text-white [color-scheme:dark] focus:border-pink-300/50 focus:outline-none"
                />
              </label>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/45">Напомнить</div>
              <div className="flex flex-wrap gap-1.5">
                {REMINDER_PRESETS.map((p) => (
                  <button
                    key={p.lead}
                    onClick={() => setLead(p.lead)}
                    disabled={saving}
                    aria-pressed={lead === p.lead}
                    className={`rounded-full border px-3 py-1 text-xs font-bold transition ${lead === p.lead ? 'border-pink-300/50 bg-pink-400/20 text-pink-100' : 'border-white/10 text-white/55 hover:text-white'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-white/45">
              <Icon name="Globe" size={12} />
              Часовой пояс: {tz}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
          <Icon name="TriangleAlert" size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            {error.message}
            {error.code === 'notes_login' && (
              <button onClick={() => openSettings('account')} className="ml-2 font-bold underline">
                Войти
              </button>
            )}
            {error.retryable && <div className="mt-0.5 text-xs text-rose-200/70">Введённый текст сохранён в окне, можно повторить.</div>}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} disabled={saving} className="rounded-xl px-3.5 py-2 text-sm font-bold text-white/65 hover:text-white disabled:opacity-50">
          Отмена
        </button>
        <button
          onClick={submit}
          disabled={saving || !text.trim()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-extrabold text-white shadow-[0_8px_24px_-8px_rgba(236,72,153,0.7)] transition disabled:opacity-50"
        >
          <Icon name={saving ? 'Loader' : 'Save'} size={16} className={saving ? 'animate-spin' : ''} />
          {saving ? 'Сохраняю…' : error?.retryable ? 'Повторить' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
