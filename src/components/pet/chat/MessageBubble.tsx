import { useState } from 'react';
import Icon from '@/components/ui/icon';
import type { ChatMessage } from '@/store/petStore';
import { TEXT_ACTIONS } from '@/utils/petAi';
import { RichText } from '../RichText';

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className="flex items-center gap-1 text-[11px] font-semibold text-white/40 transition hover:text-white"
    >
      <Icon name={done ? 'Check' : 'Copy'} size={11} />
      {done ? 'Скопировано' : 'Копировать'}
    </button>
  );
}

export function MessageBubble({
  msg,
  icon,
  onRetry,
  busy,
}: {
  msg: ChatMessage;
  icon: string;
  onRetry: (m: ChatMessage) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (msg.role === 'user') {
    if (msg.task) {
      const a = TEXT_ACTIONS[msg.task.action];
      const long = msg.task.source.length > 280;
      return (
        <div className="flex justify-end pa-rise">
          <div className="max-w-[85%] overflow-hidden rounded-2xl rounded-br-md border border-violet-300/30 bg-gradient-to-br from-violet-500/30 to-pink-500/25">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-pink-100">
              <Icon name={a.icon} size={12} />
              {a.label}
            </div>
            <div className="px-3.5 py-2 text-[13px] leading-relaxed text-white/85 whitespace-pre-wrap">
              {long && !expanded ? `${msg.task.source.slice(0, 280)}…` : msg.task.source}
              {long && (
                <button onClick={() => setExpanded(!expanded)} className="ml-1 text-xs font-bold text-pink-200 hover:text-white">
                  {expanded ? 'свернуть' : 'показать всё'}
                </button>
              )}
            </div>
            {msg.text && <div className="border-t border-white/10 px-3.5 py-1.5 text-xs text-white/70">Пожелание: {msg.text}</div>}
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-end pa-rise">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-violet-500 to-pink-500 px-4 py-2.5 text-sm leading-relaxed text-white shadow-[0_8px_20px_-8px_rgba(236,72,153,0.6)]">
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.kind === 'error') {
    return (
      <div className="flex items-end gap-2 pa-rise">
        <div className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rose-500/15">
          <Icon name="TriangleAlert" size={14} className="text-rose-300" />
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-rose-300/25 bg-rose-500/[0.08] px-4 py-2.5 text-sm">
          <div className="font-bold text-rose-100">Ответ AI не получен</div>
          <div className="mt-0.5 text-xs text-rose-100/70">{msg.error?.message}</div>
          {(msg.error?.code?.startsWith('own_') || msg.error?.code === 'daily_user' || msg.error?.code === 'budget') && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('petagent:settings', { detail: 'ai' }))}
              className="mt-2 mr-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-200/30 bg-cyan-400/15 px-3 py-1 text-xs font-bold text-cyan-50 transition hover:bg-cyan-400/30"
            >
              <Icon name="KeyRound" size={12} />
              {msg.error.code.startsWith('own_') ? 'Проверить ключ' : 'Подключить свой ключ'}
            </button>
          )}
          {msg.error?.retryable && msg.retry && (
            <button
              disabled={busy}
              onClick={() => onRetry(msg)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-rose-200/30 bg-rose-400/15 px-3 py-1 text-xs font-bold text-rose-50 transition hover:bg-rose-400/30 disabled:opacity-40"
            >
              <Icon name="RotateCcw" size={12} />
              Повторить
            </button>
          )}
        </div>
      </div>
    );
  }

  const isTask = !!msg.task;
  return (
    <div className="flex items-end gap-2 pa-rise">
      <img src={icon} alt="" className="mb-1 h-7 w-7 shrink-0 rounded-lg bg-white/5 object-contain p-0.5" />
      <div
        className={`max-w-[85%] rounded-2xl rounded-bl-md border px-4 py-2.5 text-sm leading-relaxed text-white/90 ${
          isTask ? 'border-cyan-300/25 bg-cyan-400/[0.07]' : 'border-white/[0.08] bg-white/[0.06]'
        }`}
      >
        {isTask && (
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-cyan-200">
            <Icon name="Sparkles" size={12} />
            Результат · {TEXT_ACTIONS[msg.task!.action].label}
          </div>
        )}
        <RichText text={msg.text} />
        <div className="mt-2 flex items-center gap-3">
          {msg.kind === 'legacy' ? (
            <span className="text-[10px] font-semibold text-white/35">Шаблонный ответ из старой версии — не AI</span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300/60">
              <Icon name="Sparkles" size={10} />
              AI
            </span>
          )}
          <CopyBtn text={msg.text} />
        </div>
      </div>
    </div>
  );
}
