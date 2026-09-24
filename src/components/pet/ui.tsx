import type { ReactNode } from 'react';
import Icon from '@/components/ui/icon';

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass p-5 ${className}`}>{children}</div>;
}

export function PanelTitle({ icon, title, right }: { icon: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={15} className="text-white/50" />
        <span className="pa-label">{title}</span>
      </div>
      {right}
    </div>
  );
}

export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] border border-white/10 px-2.5 py-1 text-xs font-bold text-white/80 ${className}`}>
      {children}
    </span>
  );
}

export function GameHud({
  title,
  hint,
  stats,
  onExit,
}: {
  title: string;
  hint?: string;
  stats?: { icon: string; value: ReactNode; tone?: string }[];
  onExit?: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {onExit && (
          <button onClick={onExit} className="icon-btn !h-9 !w-9" title="Назад к играм">
            <Icon name="ArrowLeft" size={16} />
          </button>
        )}
        <div>
          <div className="font-display text-base font-bold text-white">{title}</div>
          {hint && <div className="text-xs text-white/50">{hint}</div>}
        </div>
      </div>
      {stats && (
        <div className="flex gap-2">
          {stats.map((s, i) => (
            <div key={i} className={`flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-extrabold tabular-nums ${s.tone ?? 'text-white'}`}>
              <Icon name={s.icon} size={14} />
              {s.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GameResult({
  pet,
  title,
  subtitle,
  reward,
  onAgain,
  onExit,
}: {
  pet: ReactNode;
  title: string;
  subtitle?: string;
  reward?: string;
  onAgain?: () => void;
  onExit: () => void;
}) {
  return (
    <div className="pa-field flex flex-col items-center px-6 py-8 text-center">
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="pa-star"
            style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${(i % 5) * 0.4}s` }}
          />
        ))}
      </div>
      <div className="relative pa-pop">{pet}</div>
      <div className="relative mt-2 font-display text-2xl font-bold text-white pa-rise">{title}</div>
      {subtitle && <div className="relative mt-1 text-sm text-white/60 pa-rise">{subtitle}</div>}
      {reward && (
        <div className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-400/15 border border-emerald-300/30 px-4 py-1.5 text-sm font-extrabold text-emerald-300 pa-pop">
          <Icon name="Sparkles" size={15} />
          {reward}
        </div>
      )}
      <div className="relative mt-6 flex gap-2">
        {onAgain && (
          <button onClick={onAgain} className="btn-ghost">
            <Icon name="RotateCcw" size={16} />
            Ещё раз
          </button>
        )}
        <button onClick={onExit} className="btn-neon">
          Готово
        </button>
      </div>
    </div>
  );
}
