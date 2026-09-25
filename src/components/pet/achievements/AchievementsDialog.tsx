import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { useAchievementStore } from '@/store/achievementStore';
import { ACHIEVEMENTS, CATEGORIES, RARITY, progressOf, type Category, type Rarity } from './catalog';
import { useAchievementCtx } from './useAchievements';
import { Medal } from './Medal';

const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export function AchievementsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const ctx = useAchievementCtx();
  const unlocked = useAchievementStore((s) => s.unlocked);
  const [cat, setCat] = useState<Category | 'all'>('all');

  const list = useMemo(() => {
    const items = ACHIEVEMENTS.filter((a) => cat === 'all' || a.category === cat);
    return items
      .map((a) => ({ a, ok: !!unlocked[a.id], p: progressOf(a, ctx) }))
      .sort((x, y) => Number(y.ok) - Number(x.ok) || y.p - x.p || RARITY_ORDER.indexOf(x.a.rarity) - RARITY_ORDER.indexOf(y.a.rarity));
  }, [cat, unlocked, ctx]);

  const byRarity = RARITY_ORDER.map((r) => ({
    r,
    total: ACHIEVEMENTS.filter((a) => a.rarity === r).length,
    got: ACHIEVEMENTS.filter((a) => a.rarity === r && unlocked[a.id]).length,
  }));
  const total = Object.keys(unlocked).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ach-dialog max-h-[88vh] max-w-3xl gap-0 overflow-hidden border-white/10 p-0 text-white">
        <div className="relative overflow-hidden border-b border-white/10 p-5 sm:p-6">
          <div className="ach-dialog-glow" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <DialogTitle className="font-display text-2xl font-bold">Коллекция наград</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-white/55">
                Собрано {total} из {ACHIEVEMENTS.length}. Каждая награда приносит питомцу опыт.
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {byRarity.map(({ r, total: t, got }) => (
                <div key={r} className={`rounded-xl border px-2.5 py-1.5 text-center ${RARITY[r].chip}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">{RARITY[r].label}</div>
                  <div className="text-sm font-extrabold tabular-nums">
                    {got}/{t}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => {
              const active = cat === c.id;
              const cnt = ACHIEVEMENTS.filter((a) => c.id === 'all' || a.category === c.id);
              const got = cnt.filter((a) => unlocked[a.id]).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    active ? 'border-transparent bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-[0_6px_18px_-6px_rgba(236,72,153,0.7)]' : 'border-white/10 bg-white/[0.05] text-white/65 hover:text-white'
                  }`}
                >
                  <Icon name={c.icon} size={13} />
                  {c.label}
                  <span className={`tabular-nums ${active ? 'text-white/80' : 'text-white/35'}`}>
                    {got}/{cnt.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid max-h-[58vh] auto-rows-max grid-cols-1 content-start gap-2.5 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5">
          {list.map(({ a, ok, p }) => {
            const r = RARITY[a.rarity];
            const secret = a.hidden && !ok;
            const v = Math.min(a.goal, Math.floor(a.value(ctx)));
            const date = ok ? new Date(unlocked[a.id]).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
            return (
              <div
                key={a.id}
                className={`ach-card relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 ${ok ? `${r.ring} ach-card-on ach-${a.rarity}` : 'border-white/[0.07] bg-white/[0.03]'}`}
              >
                <Medal a={a} unlocked={ok} size={52} progress={p} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm font-bold ${ok ? 'text-white' : 'text-white/70'}`}>{secret ? 'Секретная награда' : a.title}</span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-white/50">{secret ? 'Условие откроется, когда получишь её' : a.desc}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${r.chip}`}>{r.label}</span>
                    <span className="text-[10px] font-bold text-amber-200/80">+{a.xp} XP</span>
                    {ok ? (
                      <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-300">
                        <Icon name="Check" size={11} />
                        {date}
                      </span>
                    ) : (
                      !secret && (
                        <span className="ml-auto text-[10px] font-bold tabular-nums text-white/45">
                          {v}/{a.goal}
                        </span>
                      )
                    )}
                  </div>
                  {!ok && !secret && (
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <div className={`h-full rounded-full bg-gradient-to-r ${r.grad}`} style={{ width: `${p * 100}%` }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
