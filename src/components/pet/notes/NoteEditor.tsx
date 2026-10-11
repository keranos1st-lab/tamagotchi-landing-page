import { useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { useNoteDraft } from '@/store/noteDraftStore';
import { NOTE_MAX, type Note } from '@/utils/notesApi';
import { openSettings } from '../account/AccountButton';

export function NoteEditor({ onSaved, onCancel }: { onSaved: (note: Note) => void; onCancel: () => void }) {
  const { text, id, saving, error, setText, save } = useNoteDraft();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = async () => {
    const note = await save();
    if (note) onSaved(note);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-5">
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
        rows={8}
        className="min-h-[160px] w-full flex-1 resize-none rounded-2xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-pink-300/50 focus:outline-none disabled:opacity-60"
      />
      <div className="text-right text-[11px] text-white/40">
        {text.length} / {NOTE_MAX}
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
            {error.code !== 'notes_login' && error.code !== 'notes_empty' && <div className="mt-0.5 text-xs text-rose-200/70">Введённый текст сохранён в окне, можно повторить.</div>}
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
