import Icon from '@/components/ui/icon';
import { useVoiceStore, STATUS_LABEL } from '@/store/voiceStore';
import { cancelVoice, toggleVoice } from '@/utils/voiceDialog';
import { PillButton } from './PetActionPill';

export function PipMicButton() {
  const status = useVoiceStore((s) => s.status);
  const active = status !== 'idle';
  return (
    <PillButton
      title={active ? 'Остановить голосовой диалог' : 'Сказать голосом'}
      icon={status === 'listening' ? 'Square' : active ? 'X' : 'Mic'}
      onClick={() => (status === 'listening' ? toggleVoice() : active ? cancelVoice() : toggleVoice())}
    />
  );
}

export function PipVoiceStatus() {
  const status = useVoiceStore((s) => s.status);
  const level = useVoiceStore((s) => s.level);
  const heard = useVoiceStore((s) => s.heard);
  const reply = useVoiceStore((s) => s.reply);
  const note = useVoiceStore((s) => s.note);

  if (status === 'idle' && !note) return null;

  const isNote = status === 'idle';
  const text = status === 'speaking' ? reply : isNote ? note : heard;
  const waiting = status === 'transcribing' || status === 'thinking';

  return (
    <div
      role="status"
      data-testid="pip-voice"
      className={`absolute inset-x-2 top-2 z-10 rounded-xl px-2.5 py-2 text-left shadow-xl ${isNote ? 'bg-amber-50 text-amber-900' : 'bg-white text-slate-800'}`}
    >
      {!isNote && (
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-pink-600">
          <Icon name={status === 'listening' ? 'Mic' : status === 'speaking' ? 'Volume2' : 'LoaderCircle'} size={11} className={waiting ? 'animate-spin' : ''} />
          {STATUS_LABEL[status]}
          {status === 'listening' && (
            <span className="ml-auto flex h-3 items-end gap-0.5">
              {[0.3, 0.6, 1, 0.6, 0.3].map((k, i) => (
                <span key={i} className="w-0.5 rounded-full bg-pink-500 transition-all" style={{ height: `${20 + Math.min(1, level * k * 1.6) * 80}%` }} />
              ))}
            </span>
          )}
        </div>
      )}
      {text && (
        <div className={`max-h-16 overflow-y-auto text-xs font-semibold leading-snug ${waiting ? 'text-slate-500' : ''}`}>{waiting ? `«${text}»` : text}</div>
      )}
      {!isNote && (
        <div className="mt-1.5 flex gap-1.5">
          {status === 'listening' && (
            <button onClick={toggleVoice} className="flex-1 rounded-full bg-pink-500 px-2.5 py-1 text-[11px] font-extrabold text-white hover:bg-pink-600">
              Готово
            </button>
          )}
          <button onClick={cancelVoice} className="flex-1 rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100">
            {status === 'speaking' ? 'Остановить' : 'Отмена'}
          </button>
        </div>
      )}
    </div>
  );
}
