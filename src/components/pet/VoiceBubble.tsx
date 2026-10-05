import Icon from '@/components/ui/icon';
import { useVoiceStore, STATUS_LABEL } from '@/store/voiceStore';

export function VoiceBubble({ below = false }: { below?: boolean }) {
  const status = useVoiceStore((s) => s.status);
  const level = useVoiceStore((s) => s.level);
  const heard = useVoiceStore((s) => s.heard);
  const reply = useVoiceStore((s) => s.reply);
  const note = useVoiceStore((s) => s.note);

  if (status === 'idle' && !note) return null;

  const text = status === 'speaking' ? reply : status === 'idle' ? note : heard;
  const isNote = status === 'idle';

  return (
    <div
      role="status"
      className={`absolute left-1/2 z-20 w-[260px] -translate-x-1/2 rounded-2xl px-3.5 py-2.5 text-left shadow-xl pa-pop ${
        below ? 'top-[112px]' : 'bottom-full mb-1'
      } ${isNote ? 'bg-amber-50 text-amber-900' : 'bg-white text-slate-800'}`}
    >
      {!isNote && (
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-pink-600">
          <Icon name={status === 'listening' ? 'Mic' : status === 'speaking' ? 'Volume2' : 'LoaderCircle'} size={11} className={status === 'transcribing' || status === 'thinking' ? 'animate-spin' : ''} />
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
        <div className={`max-h-24 overflow-y-auto text-xs font-semibold leading-snug ${status === 'transcribing' || status === 'thinking' ? 'text-slate-500' : ''}`}>
          {status === 'thinking' || status === 'transcribing' ? `«${text}»` : text}
        </div>
      )}
      <span className={`absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 ${isNote ? 'bg-amber-50' : 'bg-white'} ${below ? '-top-1' : '-bottom-1'}`} />
    </div>
  );
}
