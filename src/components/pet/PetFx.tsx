import type { PetAnim } from './sprites';
import type { PetType } from '@/store/petStore';

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
      { ch: '✦', x: 80, y: 20, d: 0.2, s: 0.6, c: '#fde047' },
      { ch: '❤', x: 20, y: 24, d: 0.9, s: 0.6, c: '#f472b6' },
    ],
  },
  beg: {
    cls: 'fx-beg',
    items: [
      { ch: '❤', x: 78, y: 16, d: 0, s: 0.9, c: '#f472b6' },
      { ch: '?', x: 18, y: 20, d: 0.8, s: 0.8, c: '#fbcfe8' },
    ],
  },
  pet: {
    cls: 'fx-love',
    items: [
      { ch: '❤', x: 18, y: 30, d: 0, s: 0.9, c: '#f472b6' },
      { ch: '❤', x: 76, y: 24, d: 0.35, s: 1.1, c: '#fb7185' },
      { ch: '✦', x: 30, y: 12, d: 0.7, s: 0.6, c: '#fde68a' },
      { ch: '❤', x: 64, y: 8, d: 1.05, s: 0.7, c: '#f9a8d4' },
      { ch: '✦', x: 84, y: 44, d: 1.4, s: 0.5, c: '#fde68a' },
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

const SIG_FX: Record<PetType, { cls: string; items: (P & { ch: string })[] }> = {
  cat: { cls: 'fx-idea', items: [{ ch: '</>', x: 72, y: 12, d: 0, s: 0.7, c: '#67e8f9' }, { ch: '{ }', x: 16, y: 18, d: 0.6, s: 0.7, c: '#a78bfa' }, { ch: '✓', x: 60, y: 2, d: 1.2, s: 0.9, c: '#34d399' }] },
  dog: { cls: 'fx-burst', items: [{ ch: '★', x: 80, y: 30, d: 0.1, s: 0.7, c: '#fde047' }, { ch: '♥', x: 16, y: 26, d: 0.6, s: 0.8, c: '#f472b6' }, { ch: '!', x: 70, y: 6, d: 0, s: 1.2, c: '#fde047' }] },
  fox: { cls: 'fx-puff', items: [{ ch: '💨', x: 72, y: 34, d: 0, s: 0.8 }, { ch: '💨', x: 12, y: 50, d: 0.5, s: 0.7 }, { ch: '✦', x: 50, y: 0, d: 0.9, s: 0.6, c: '#fdba74' }] },
  dragon: { cls: 'fx-ember', items: [{ ch: '✦', x: 88, y: 28, d: 0, s: 0.6, c: '#fb923c' }, { ch: '•', x: 94, y: 36, d: 0.3, s: 0.9, c: '#fde047' }, { ch: '✦', x: 84, y: 20, d: 0.6, s: 0.5, c: '#f472b6' }, { ch: '•', x: 96, y: 24, d: 0.9, s: 0.7, c: '#fb923c' }] },
  bunny: { cls: 'fx-burst', items: [{ ch: '✦', x: 10, y: 60, d: 0.2, s: 0.7, c: '#f9a8d4' }, { ch: '✦', x: 84, y: 60, d: 0.3, s: 0.7, c: '#86efac' }, { ch: '♥', x: 50, y: 0, d: 0.7, s: 0.8, c: '#f472b6' }] },
  panda: { cls: 'fx-crumb', items: [{ ch: '🍃', x: 30, y: 44, d: 0, s: 0.6 }, { ch: '🍃', x: 66, y: 40, d: 0.7, s: 0.5 }, { ch: '♪', x: 74, y: 10, d: 1.4, s: 0.7, c: '#86efac' }] },
  owl: { cls: 'fx-idea', items: [{ ch: '?', x: 76, y: 8, d: 0, s: 0.9, c: '#fcd34d' }, { ch: '!', x: 20, y: 12, d: 1.1, s: 0.9, c: '#fcd34d' }] },
  bird: { cls: 'fx-note', items: [{ ch: '♪', x: 78, y: 16, d: 0, s: 0.9, c: '#67e8f9' }, { ch: '♫', x: 18, y: 10, d: 0.45, s: 1, c: '#a78bfa' }, { ch: '♪', x: 64, y: 0, d: 0.9, s: 0.7, c: '#f472b6' }, { ch: '♬', x: 30, y: 26, d: 1.35, s: 0.8, c: '#fde047' }] },
};

export function PetFx({ anim, size, type }: { anim: PetAnim; size: number; type: PetType }) {
  const fx = anim === 'special' ? SIG_FX[type] : FX[anim];
  if (!fx || size < 60) return null;
  const base = Math.max(10, size * 0.11);
  return (
    <div key={anim} className="pointer-events-none absolute inset-0 select-none">
      {anim === 'pet' && (
        <>
          <span className="fx-blush" style={{ left: '30%', top: '40%', width: size * 0.12, height: size * 0.05 }} />
          <span className="fx-blush" style={{ left: '58%', top: '40%', width: size * 0.12, height: size * 0.05 }} />
          <span className="fx-hand" style={{ fontSize: base * 1.6, left: '50%', top: '-6%' }}>
            🤚
          </span>
        </>
      )}
      {anim === 'special' && type === 'dragon' && (
        <span className="fx-flame" style={{ left: '78%', top: '26%', width: size * 0.5, height: size * 0.22 }} />
      )}
      {anim === 'wave' && (
        <span className="fx-wavelines" style={{ fontSize: base * 1.1, right: '4%', top: '18%' }}>
          ʚ
        </span>
      )}
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
