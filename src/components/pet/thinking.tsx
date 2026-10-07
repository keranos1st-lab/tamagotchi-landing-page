import type { PetType } from '@/store/petStore';
import type { PetAnim } from './sprites';

type ThinkFx = 'code' | 'book' | 'leaf' | 'notes' | 'smoke' | 'dots';

export interface ThinkPose {
  anim: PetAnim;
  label: string;
  fx: ThinkFx;
  tone: string;
}

export const THINK_POSES: Record<PetType, ThinkPose> = {
  cat: { anim: 'trick', label: 'Кодик пишет код…', fx: 'code', tone: 'cyan' },
  owl: { anim: 'study', label: 'листает книгу…', fx: 'book', tone: 'amber' },
  panda: { anim: 'eat', label: 'жуёт бамбук и думает…', fx: 'leaf', tone: 'emerald' },
  bird: { anim: 'play', label: 'напевает ответ…', fx: 'notes', tone: 'sky' },
  dragon: { anim: 'idle', label: 'пускает дымок и думает…', fx: 'smoke', tone: 'violet' },
  fox: { anim: 'trick', label: 'виляет хвостом и думает…', fx: 'dots', tone: 'orange' },
  bunny: { anim: 'trick', label: 'шевелит ушками и думает…', fx: 'dots', tone: 'pink' },
  dog: { anim: 'trick', label: 'встряхивает шёрстку и думает…', fx: 'dots', tone: 'amber' },
};

export const thinkingAnim = (type: PetType): PetAnim => THINK_POSES[type].anim;

const NOSE: Partial<Record<PetType, { x: number; y: number }>> = {
  dragon: { x: 50, y: 58 },
};

const TONE_TEXT: Record<string, string> = {
  cyan: 'text-cyan-200 border-cyan-300/20 bg-cyan-400/[0.07]',
  amber: 'text-amber-200 border-amber-300/20 bg-amber-400/[0.07]',
  emerald: 'text-emerald-200 border-emerald-300/20 bg-emerald-400/[0.07]',
  sky: 'text-sky-200 border-sky-300/20 bg-sky-400/[0.07]',
  violet: 'text-violet-200 border-violet-300/20 bg-violet-400/[0.07]',
  orange: 'text-orange-200 border-orange-300/20 bg-orange-400/[0.07]',
  pink: 'text-pink-200 border-pink-300/20 bg-pink-400/[0.07]',
};

export const toneClass = (type: PetType) => TONE_TEXT[THINK_POSES[type].tone];

const FLOATERS: Record<Exclude<ThinkFx, 'smoke'>, { ch: string; color: string }[]> = {
  code: [
    { ch: '</>', color: '#67e8f9' },
    { ch: '{ }', color: '#a5f3fc' },
    { ch: '=>', color: '#67e8f9' },
  ],
  book: [
    { ch: '?', color: '#fde68a' },
    { ch: '!', color: '#fcd34d' },
    { ch: '?', color: '#fef3c7' },
  ],
  leaf: [
    { ch: '❦', color: '#86efac' },
    { ch: '❧', color: '#4ade80' },
    { ch: '❦', color: '#bbf7d0' },
  ],
  notes: [
    { ch: '♪', color: '#7dd3fc' },
    { ch: '♫', color: '#f9a8d4' },
    { ch: '♪', color: '#fde047' },
  ],
  dots: [
    { ch: '?', color: '#fde68a' },
    { ch: '…', color: '#e9d5ff' },
    { ch: '?', color: '#fbcfe8' },
  ],
};

export function ThinkFxLayer({ type, size }: { type: PetType; size: number }) {
  const { fx } = THINK_POSES[type];
  if (fx === 'smoke') {
    const n = NOSE[type] ?? { x: 50, y: 50 };
    return (
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 2 }}>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <span
            key={k}
            className="tk-smoke"
            style={{
              left: `${n.x + (k % 2 ? 3 : -3)}%`,
              top: `${n.y}%`,
              width: size * 0.13,
              height: size * 0.13,
              animationDelay: `${k * 0.3}s`,
            }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 2 }}>
      {FLOATERS[fx].map((it, k) => (
        <span
          key={k}
          className="tk-float"
          style={{
            left: `${58 + (k % 2) * 14}%`,
            top: '22%',
            fontSize: size * 0.1,
            color: it.color,
            textShadow: `0 0 8px ${it.color}`,
            animationDelay: `${k * 0.6}s`,
            fontFamily: fx === 'code' ? 'ui-monospace, monospace' : undefined,
            fontWeight: 800,
          }}
        >
          {it.ch}
        </span>
      ))}
    </div>
  );
}
