import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAchievementStore } from '@/store/achievementStore';
import { ACHIEVEMENTS, RARITY } from './catalog';
import { Medal } from './Medal';
import { sfx } from '../sound';

export function AchievementToast() {
  const queue = useAchievementStore((s) => s.queue);
  const shift = useAchievementStore((s) => s.shift);
  const [leaving, setLeaving] = useState(false);
  const id = queue[0];
  const a = ACHIEVEMENTS.find((x) => x.id === id);

  useEffect(() => {
    if (!a) return;
    setLeaving(false);
    if (a.rarity === 'legendary' || a.rarity === 'epic') sfx.levelUp();
    else sfx.win();
    const t1 = setTimeout(() => setLeaving(true), a.rarity === 'legendary' ? 4200 : 3200);
    const t2 = setTimeout(() => shift(), a.rarity === 'legendary' ? 4600 : 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [a, shift]);

  if (!a) return null;
  const r = RARITY[a.rarity];

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-5 z-[70] flex justify-center px-4">
      <div
        key={a.id}
        onClick={() => setLeaving(true)}
        className={`ach-toast pointer-events-auto relative flex w-full max-w-sm items-center gap-3.5 overflow-hidden rounded-2xl border p-3.5 pr-5 ${r.ring} ${leaving ? 'ach-toast-out' : 'ach-toast-in'}`}
        style={{ boxShadow: `0 20px 50px -12px rgba(0,0,0,0.7), 0 0 40px -8px ${r.glow}` }}
      >
        <span className="ach-toast-shine" />
        {Array.from({ length: a.rarity === 'common' ? 0 : 10 }).map((_, i) => (
          <span key={i} className="ach-spark" style={{ left: `${10 + ((i * 37) % 80)}%`, animationDelay: `${0.2 + i * 0.07}s`, background: r.glow }} />
        ))}
        <div className="ach-toast-medal relative">
          <Medal a={a} unlocked size={56} />
        </div>
        <div className="relative min-w-0 flex-1">
          <div className={`text-[10px] font-extrabold uppercase tracking-[0.16em] ${r.text}`}>
            Новая награда · {r.label}
          </div>
          <div className="font-display text-base font-bold text-white">{a.title}</div>
          <div className="truncate text-xs text-white/60">{a.desc}</div>
        </div>
        <div className="relative rounded-lg border border-amber-300/30 bg-amber-400/15 px-2 py-1 text-xs font-extrabold text-amber-200">+{a.xp}</div>
      </div>
    </div>,
    document.body,
  );
}
