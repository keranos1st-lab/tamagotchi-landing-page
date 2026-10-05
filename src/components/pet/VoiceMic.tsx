import Icon from '@/components/ui/icon';
import { useVoiceStore, STATUS_LABEL } from '@/store/voiceStore';
import { toggleVoice } from '@/utils/voiceDialog';

export function VoiceMic({ className = '', size = 18, disabled = false }: { className?: string; size?: number; disabled?: boolean }) {
  const status = useVoiceStore((s) => s.status);
  const level = useVoiceStore((s) => s.level);
  const active = status !== 'idle';
  const icon = status === 'listening' ? 'Square' : status === 'idle' ? 'Mic' : status === 'speaking' ? 'Volume2' : 'LoaderCircle';

  return (
    <button
      type="button"
      onClick={toggleVoice}
      disabled={disabled && !active}
      title={active ? (status === 'listening' ? 'Закончить запись' : 'Остановить') : 'Сказать голосом'}
      aria-label={active ? STATUS_LABEL[status] : 'Голосовой ввод'}
      className={`relative grid shrink-0 place-items-center rounded-xl transition disabled:opacity-40 ${
        active ? 'bg-rose-500 text-white shadow-[0_0_0_4px_rgba(244,63,94,0.2)]' : 'bg-white/[0.06] text-cyan-200 hover:bg-white/10'
      } ${className}`}
      style={status === 'listening' ? { boxShadow: `0 0 0 ${3 + level * 9}px rgba(244,63,94,0.22)` } : undefined}
    >
      <Icon name={icon} size={size} className={status === 'transcribing' || status === 'thinking' ? 'animate-spin' : ''} />
    </button>
  );
}

export function VoiceStatusLine({ className = '' }: { className?: string }) {
  const status = useVoiceStore((s) => s.status);
  const heard = useVoiceStore((s) => s.heard);
  const note = useVoiceStore((s) => s.note);
  if (status === 'idle' && !note) return null;
  return (
    <div className={`text-center text-[11px] ${note && status === 'idle' ? 'text-amber-200' : 'text-cyan-100/80'} ${className}`} role="status">
      {status !== 'idle' ? (
        <>
          <b>{STATUS_LABEL[status]}</b>
          {heard && status !== 'listening' && <span className="text-white/55"> «{heard.length > 80 ? `${heard.slice(0, 80)}…` : heard}»</span>}
        </>
      ) : (
        note
      )}
    </div>
  );
}
