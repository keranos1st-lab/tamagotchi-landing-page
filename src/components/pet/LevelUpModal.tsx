import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePetStore, type EvolutionStage } from '@/store/petStore';
import Icon from '@/components/ui/icon';
import { PetSprite } from './PetSprite';
import type { PetAnim } from './sprites';

const COLORS = ['#f472b6', '#a78bfa', '#22d3ee', '#fde047', '#34d399', '#fb923c', '#ffffff'];
const STAGE_LABEL: Record<EvolutionStage, string> = { baby: 'Малыш', teen: 'Подросток', adult: 'Взрослый' };

const PERKS: Record<number, string> = {
  2: 'Питомец стал чуть сообразительнее',
  3: 'Открылись новые фразы в чате',
  5: 'Эволюция! Питомец подрос',
  10: 'Эволюция! Питомец стал взрослым',
};

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }).map((_, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        return {
          id: i,
          color: COLORS[i % COLORS.length],
          x: 50 + side * (Math.random() * 12),
          dx: side * (20 + Math.random() * 45),
          dy: -(35 + Math.random() * 45),
          rot: Math.random() * 720 - 360,
          delay: Math.random() * 0.25 + (i > 60 ? 0.9 : 0),
          dur: 2.4 + Math.random() * 1.4,
          w: 6 + Math.random() * 6,
          h: Math.random() < 0.3 ? 6 + Math.random() * 6 : 10 + Math.random() * 8,
          round: Math.random() < 0.3,
        };
      }),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="lu-confetti"
          style={
            {
              left: `${p.x}%`,
              width: p.w,
              height: p.h,
              background: p.color,
              borderRadius: p.round ? '50%' : 2,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              '--dx': `${p.dx}vw`,
              '--dy': `${p.dy}vh`,
              '--rot': `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function LevelUpModal() {
  const levelUp = usePetStore((s) => s.levelUp);
  const clear = usePetStore((s) => s.clearLevelUp);
  const type = usePetStore((s) => s.type);
  const name = usePetStore((s) => s.name);
  const expToNext = usePetStore((s) => s.expToNext);
  const [anim, setAnim] = useState<PetAnim>('jump');
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!levelUp) return;
    setShown(levelUp.from);
    setAnim('jump');
    const steps: ReturnType<typeof setTimeout>[] = [];
    steps.push(setTimeout(() => setShown(levelUp.to), 650));
    steps.push(setTimeout(() => setAnim('play'), 1500));
    steps.push(setTimeout(() => setAnim('wave'), 3600));
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && clear();
    window.addEventListener('keydown', onKey);
    return () => {
      steps.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
    };
  }, [levelUp, clear]);

  if (!levelUp) return null;

  const evolved = levelUp.stageFrom !== levelUp.stageTo;
  const perk = evolved
    ? `${STAGE_LABEL[levelUp.stageFrom]} → ${STAGE_LABEL[levelUp.stageTo]}`
    : PERKS[levelUp.to] ?? 'Больше опыта — больше пользы от питомца';

  return createPortal(
    <div
      key={levelUp.id}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={clear}
    >
      <div className="absolute inset-0 bg-[#05040f]/75 backdrop-blur-md lu-fade" />
      <div className="lu-rays pointer-events-none absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2" />
      <Confetti />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-[32px] border border-white/15 text-center lu-card"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, rgba(236,72,153,0.45), transparent 60%), radial-gradient(100% 70% at 50% 100%, rgba(139,92,246,0.45), transparent 70%), #110e2b',
          boxShadow: '0 40px 120px -20px rgba(236,72,153,0.55), inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      >
        <div className="relative px-6 pb-6 pt-8">
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-200 lu-rise" style={{ animationDelay: '.1s' }}>
            <Icon name="Sparkles" size={12} />
            {evolved ? 'Эволюция' : 'Новый уровень'}
          </div>

          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-white lu-rise" style={{ animationDelay: '.2s' }}>
            Уровень <span className="text-gradient">повышен!</span>
          </h2>

          <div className="relative mx-auto mt-4 grid h-28 w-28 place-items-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-pink-500 to-violet-600 lu-badge" />
            <div className="absolute inset-[5px] rounded-full bg-[#150f33]" />
            <div className="absolute inset-0 rounded-full lu-ring" />
            <span key={shown} className="relative font-display text-5xl font-extrabold text-white lu-num">
              {shown}
            </span>
          </div>

          <div className="relative mx-auto -mt-2 flex h-44 items-end justify-center">
            <div className="absolute bottom-2 h-10 w-40 rounded-[50%] bg-pink-500/40 blur-xl" />
            <div className="lu-pet">
              <PetSprite type={type} anim={anim} size={170} />
            </div>
          </div>

          <p className="mt-1 text-lg font-extrabold text-white lu-rise" style={{ animationDelay: '.5s' }}>
            {name} — теперь ещё круче!
          </p>
          <div
            className={`mx-auto mt-3 flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold lu-rise ${
              evolved ? 'border-amber-300/40 bg-amber-300/10 text-amber-200' : 'border-white/10 bg-white/5 text-white/75'
            }`}
            style={{ animationDelay: '.65s' }}
          >
            <Icon name={evolved ? 'Crown' : 'TrendingUp'} size={16} />
            {perk}
          </div>
          <p className="mt-3 text-xs text-white/40 lu-rise" style={{ animationDelay: '.75s' }}>
            До следующего уровня: {expToNext} опыта
          </p>

          <button onClick={clear} className="btn-neon pa-shine mt-5 w-full !py-3.5 text-base lu-rise" style={{ animationDelay: '.85s' }}>
            Ура!
            <Icon name="PartyPopper" size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
