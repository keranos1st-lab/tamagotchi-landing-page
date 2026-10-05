import { useEffect, useRef } from 'react';
import { usePetStore } from '@/store/petStore';
import { useIqUpStore } from '@/store/iqUpStore';
import Icon from '@/components/ui/icon';
import { sfx } from './sound';
import { IQ_LEVELS, IQ_UP_HINT, IQ_UP_PHRASE, iqLevel, iqRankIndex } from './iq';

const MAX_JUMP = 20;

export function IqLevelWatcher() {
  const iq = usePetStore((s) => s.intelligence);
  const type = usePetStore((s) => s.type);
  const prev = useRef<{ iq: number; type: string } | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = { iq, type };
    if (!before || before.type !== type) return;
    const diff = iq - before.iq;
    if (diff <= 0 || diff > MAX_JUMP) return;
    const from = iqLevel(before.iq);
    const to = iqLevel(iq);
    if (iqRankIndex(to) > iqRankIndex(from)) useIqUpStore.getState().fire(to, Math.round(iq));
  }, [iq, type]);

  return null;
}

const SPARKS = Array.from({ length: 12 }).map((_, i) => ({ a: (i / 12) * 360, d: 52 + (i % 3) * 14, delay: (i % 4) * 0.06 }));

export function IqLevelToast() {
  const event = useIqUpStore((s) => s.event);
  const clear = useIqUpStore((s) => s.clear);

  useEffect(() => {
    if (!event) return;
    sfx.levelUp();
    const t = setTimeout(clear, 6500);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && clear();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [event, clear]);

  if (!event || event.level === 'baby') return null;
  const level = event.level;
  const info = IQ_LEVELS[level];

  return (
    <div key={event.id} className="pointer-events-none fixed inset-x-0 top-28 z-[95] flex justify-center px-4" role="status" aria-live="polite">
      <div
        className="iq-card pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-3xl border border-cyan-200/25 p-4 text-center"
        style={{
          background: 'radial-gradient(120% 90% at 50% 0%, rgba(34,211,238,0.35), transparent 60%), radial-gradient(100% 80% at 50% 100%, rgba(139,92,246,0.4), transparent 70%), #0f1330',
          boxShadow: '0 30px 90px -20px rgba(34,211,238,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      >
        <button onClick={clear} className="absolute right-3 top-3 text-white/40 hover:text-white" title="Закрыть">
          <Icon name="X" size={15} />
        </button>

        <div className="relative mx-auto mb-2 grid h-16 w-16 place-items-center">
          <span className="iq-ring absolute inset-0 rounded-full border-2 border-cyan-300/60" />
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="iq-spark absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-200"
              style={{ '--a': `${s.a}deg`, '--d': `${s.d}px`, animationDelay: `${s.delay}s` } as React.CSSProperties}
            />
          ))}
          <div className="iq-brain grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_30px_rgba(34,211,238,0.6)]">
            <Icon name={level === 'genius' ? 'Lightbulb' : 'Brain'} size={26} className="text-white" />
          </div>
        </div>

        <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-200">Новый уровень IQ · {event.iq}</div>
        <div className="mt-1 font-display text-2xl font-extrabold text-white">{IQ_UP_PHRASE[level as 'smart' | 'genius']}</div>
        <div className="mt-1 text-xs text-white/65">{IQ_UP_HINT[level as 'smart' | 'genius']}</div>

        <ul className="mx-auto mt-3 max-w-[260px] space-y-1 text-left text-[11px] text-white/70">
          {info.can.map((c) => (
            <li key={c} className="flex gap-1.5">
              <Icon name="Check" size={12} className="mt-0.5 shrink-0 text-cyan-300" />
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
