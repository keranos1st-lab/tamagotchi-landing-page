import type { PetAnim } from './sprites';

type P = { x: number; y: number; d: number; s?: number; c?: string };

const FX: Partial<Record<PetAnim, { cls: string; items: (P & { ch: string })[] }>> = {
  sleep: {
    cls: 'fx-z',
    items: [
      { ch: 'z', x: 62, y: 18, d: 0, s: 0.7 },
      { ch: 'z', x: 70, y: 12, d: 0.9, s: 0.9 },
      { ch: 'Z', x: 78, y: 6, d: 1.8, s: 1.15 },
    ],
  },
  eat: {
    cls: 'fx-crumb',
    items: [
      { ch: '✦', x: 38, y: 58, d: 0, s: 0.6, c: '#fbbf24' },
      { ch: '•', x: 60, y: 60, d: 0.3, s: 0.8, c: '#fb923c' },
      { ch: '✦', x: 48, y: 55, d: 0.6, s: 0.5, c: '#fde68a' },
      { ch: '•', x: 55, y: 57, d: 0.9, s: 0.7, c: '#f59e0b' },
      { ch: '❤', x: 72, y: 30, d: 1.1, s: 0.8, c: '#f472b6' },
    ],
  },
  play: {
    cls: 'fx-burst',
    items: [
      { ch: '★', x: 15, y: 30, d: 0, s: 0.9, c: '#fde047' },
      { ch: '✦', x: 82, y: 22, d: 0.25, s: 0.8, c: '#f472b6' },
      { ch: '♪', x: 25, y: 12, d: 0.5, s: 0.9, c: '#67e8f9' },
      { ch: '★', x: 78, y: 45, d: 0.75, s: 0.7, c: '#a78bfa' },
      { ch: '✦', x: 50, y: 5, d: 1, s: 0.7, c: '#fde047' },
    ],
  },
  jump: {
    cls: 'fx-burst',
    items: [
      { ch: '✦', x: 20, y: 70, d: 0, s: 0.7, c: '#fde047' },
      { ch: '✦', x: 78, y: 70, d: 0.1, s: 0.7, c: '#f472b6' },
      { ch: '·', x: 50, y: 85, d: 0.05, s: 1.4, c: '#ffffff' },
    ],
  },
  study: {
    cls: 'fx-idea',
    items: [
      { ch: '?', x: 72, y: 14, d: 0, s: 0.9, c: '#a5b4fc' },
      { ch: '✦', x: 26, y: 18, d: 0.8, s: 0.6, c: '#67e8f9' },
      { ch: '💡', x: 64, y: 4, d: 1.6, s: 0.9 },
    ],
  },
  working: {
    cls: 'fx-idea',
    items: [
      { ch: '</>', x: 70, y: 14, d: 0, s: 0.7, c: '#67e8f9' },
      { ch: '{ }', x: 22, y: 20, d: 0.9, s: 0.7, c: '#a78bfa' },
    ],
  },
  wave: {
    cls: 'fx-heart',
    items: [
      { ch: '❤', x: 74, y: 22, d: 0, s: 0.8, c: '#f472b6' },
      { ch: '✦', x: 24, y: 26, d: 0.5, s: 0.7, c: '#fde047' },
      { ch: '❤', x: 66, y: 10, d: 1, s: 0.6, c: '#fb7185' },
    ],
  },
  failed: {
    cls: 'fx-drop',
    items: [
      { ch: '💧', x: 70, y: 22, d: 0, s: 0.6 },
      { ch: '···', x: 30, y: 12, d: 1, s: 0.7, c: '#94a3b8' },
    ],
  },
};

export function PetFx({ anim, size }: { anim: PetAnim; size: number }) {
  const fx = FX[anim];
  if (!fx || size < 60) return null;
  const base = Math.max(10, size * 0.11);
  return (
    <div key={anim} className="pointer-events-none absolute inset-0 select-none">
      {fx.items.map((p, i) => (
        <span
          key={i}
          className={`absolute font-extrabold leading-none ${fx.cls}`}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: base * (p.s ?? 1),
            color: p.c ?? '#bae6fd',
            animationDelay: `${p.d}s`,
            textShadow: '0 0 8px rgba(0,0,0,0.35)',
          }}
        >
          {p.ch}
        </span>
      ))}
    </div>
  );
}
