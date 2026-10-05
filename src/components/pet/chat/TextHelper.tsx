import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import type { TextAction } from '@/store/petStore';
import { MAX_SOURCE, TEXT_ACTIONS } from '@/utils/petAi';
import { usePetStore } from '@/store/petStore';
import { IQ_LEVELS, iqLevel, iqNext } from '../iq';

export function TextHelper({
  open,
  initial,
  disabled,
  onClose,
  onRun,
}: {
  open: boolean;
  initial: string;
  disabled: boolean;
  onClose: () => void;
  onRun: (action: TextAction, source: string, note: string) => void;
}) {
  const [source, setSource] = useState(initial);
  const [note, setNote] = useState('');
  const [action, setAction] = useState<TextAction>('explain');

  useEffect(() => {
    if (open && initial) setSource(initial);
  }, [open, initial]);

  if (!open) return null;
  const len = source.trim().length;
  const iq = usePetStore.getState().intelligence;
  const lvl = iqLevel(iq);
  const cap = IQ_LEVELS[lvl].textLimit;
  const nextLvl = iqNext(iq);
  const overIq = len > cap && len <= MAX_SOURCE;
  const tooLong = len > MAX_SOURCE;

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setSource(t.slice(0, MAX_SOURCE + 500));
    } catch {
      /* пользователь может вставить вручную Ctrl+V */
    }
  };

  return (
    <div className="mx-3 mb-2 rounded-2xl border border-cyan-300/20 bg-[#0f1330]/95 p-3 pa-rise" data-pet-chat-input>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-cyan-100">
          <Icon name="FileText" size={14} />
          Помощь с текстом
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white" title="Закрыть">
          <Icon name="X" size={15} />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {(Object.keys(TEXT_ACTIONS) as TextAction[]).map((a) => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-xs font-bold transition ${
              action === a ? 'border-cyan-300/60 bg-cyan-400/20 text-white' : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white'
            }`}
          >
            <Icon name={TEXT_ACTIONS[a].icon} size={13} />
            {TEXT_ACTIONS[a].label}
          </button>
        ))}
      </div>

      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        rows={4}
        placeholder="Вставьте текст (Ctrl+V) из письма, документа или мессенджера — или выделите текст на этой странице"
        className="w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-cyan-300/40 focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <button onClick={paste} className="flex items-center gap-1 text-cyan-200/80 hover:text-cyan-100">
          <Icon name="ClipboardPaste" size={12} />
          Вставить из буфера
        </button>
        <span className={tooLong ? 'font-bold text-rose-300' : overIq ? 'font-bold text-amber-300' : 'text-white/40'}>
          {len} / {cap}
        </span>
      </div>
      {overIq && nextLvl && (
        <div className="mt-1 text-[11px] text-amber-200/90">
          Питомец уровня «{IQ_LEVELS[lvl].name}» берёт текст до {cap} символов. Обучай его, чтобы дорасти до «{IQ_LEVELS[nextLvl.level].name}» (нужно ещё {nextLvl.need} IQ).
        </div>
      )}

      {action === 'reply' && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 300))}
          placeholder="Что хотите ответить? (необязательно, например: «согласиться, но перенести на понедельник»)"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:border-cyan-300/40 focus:outline-none"
        />
      )}

      <button
        disabled={disabled || !len || tooLong}
        onClick={() => {
          onRun(action, source.trim(), note.trim());
          setSource('');
          setNote('');
        }}
        className="btn-neon mt-2 w-full !py-2 text-sm disabled:opacity-40"
      >
        <Icon name={TEXT_ACTIONS[action].icon} size={15} />
        {TEXT_ACTIONS[action].verb}
      </button>
      {tooLong && <div className="mt-1 text-center text-[11px] text-rose-300">Текст длиннее {MAX_SOURCE} символов — сократите или разбейте на части</div>}
    </div>
  );
}
