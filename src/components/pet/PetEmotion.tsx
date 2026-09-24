import { usePetStore } from '@/store/petStore';
import type { PetAnim } from './sprites';

export type Need = 'hungry' | 'tired' | 'bored' | 'sick' | 'happy' | null;

const NEED_VIEW: Record<Exclude<Need, null>, { emoji: string; text: string }> = {
  hungry: { emoji: '🍖', text: 'Хочу есть!' },
  tired: { emoji: '😴', text: 'Я устал...' },
  bored: { emoji: '🥱', text: 'Мне скучно' },
  sick: { emoji: '🤒', text: 'Мне плохо' },
  happy: { emoji: '💖', text: '' },
};

export function usePetNeed(): Need {
  const { hunger, happiness, energy, health } = usePetStore();
  if (health < 30) return 'sick';
  if (hunger < 30) return 'hungry';
  if (energy < 25) return 'tired';
  if (happiness < 35) return 'bored';
  if ((hunger + happiness + energy + health) / 4 > 85) return 'happy';
  return null;
}

export function needAnim(need: Need): PetAnim | null {
  if (need === 'tired') return 'sleep';
  if (need === 'sick' || need === 'hungry' || need === 'bored') return 'failed';
  return null;
}

export function PetEmotion({ need, compact = false }: { need: Need; compact?: boolean }) {
  if (!need) return null;
  const v = NEED_VIEW[need];
  if (need === 'happy') {
    return (
      <div className="pointer-events-none absolute -top-1 right-1 text-lg pet-heart select-none">{v.emoji}</div>
    );
  }
  return (
    <div className="pointer-events-none absolute -top-3 left-1/2 -translate-x-[10%] select-none pet-bubble">
      <div className="relative flex items-center gap-1 rounded-2xl bg-white px-2 py-1 shadow-lg">
        <span className={compact ? 'text-base' : 'text-lg'}>{v.emoji}</span>
        {!compact && <span className="whitespace-nowrap text-[11px] font-bold text-slate-700">{v.text}</span>}
        <span className="absolute -bottom-1.5 left-3 h-3 w-3 rotate-45 bg-white" />
      </div>
    </div>
  );
}
