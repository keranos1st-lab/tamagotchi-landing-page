import { useMemo, useState } from 'react';
import Icon from '@/components/ui/icon';
import { useAchievementStore } from '@/store/achievementStore';
import { Panel, PanelTitle, Chip } from './ui';
import { ACHIEVEMENTS, RARITY, progressOf, TOTAL_XP } from './achievements/catalog';
import { useAchievementCtx } from './achievements/useAchievements';
import { Medal } from './achievements/Medal';
import { AchievementsDialog } from './achievements/AchievementsDialog';

export function Achievements() {
  const ctx = useAchievementCtx();
  const unlocked = useAchievementStore((s) => s.unlocked);
  const [open, setOpen] = useState(false);

  const { done, earnedXp, recent, next } = useMemo(() => {
    const done = ACHIEVEMENTS.filter((a) => unlocked[a.id]);
    const earnedXp = done.reduce((s, a) => s + a.xp, 0);
    const recent = [...done].sort((a, b) => unlocked[b.id] - unlocked[a.id]).slice(0, 5);
    const next = ACHIEVEMENTS.filter((a) => !unlocked[a.id] && !a.hidden)
      .map((a) => ({ a, p: progressOf(a, ctx) }))
      .sort((x, y) => y.p - x.p)
      .slice(0, 2);
    return { done, earnedXp, recent, next };
  }, [unlocked, ctx]);

  const pct = Math.round((done.length / ACHIEVEMENTS.length) * 100);
  const rank = pct >= 90 ? 'Легенда' : pct >= 60 ? 'Мастер' : pct >= 35 ? 'Знаток' : pct >= 10 ? 'Искатель' : 'Новичок';

  return (
    <Panel>
      <PanelTitle icon="Trophy" title="Достижения" right={<Chip className="!text-amber-200">{done.length}/{ACHIEVEMENTS.length}</Chip>} />

      <button onClick={() => setOpen(true)} className="ach-hero group relative mb-4 flex w-full items-center gap-3 overflow-hidden rounded-2xl p-3 text-left">
        <div className="relative grid h-14 w-14 shrink-0 place-items-center">
          <svg className="absolute inset-0 -rotate-90" width="56" height="56">
            <circle cx="28" cy="28" r="25" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
            <circle cx="28" cy="28" r="25" fill="none" stroke="url(#achg)" strokeWidth="4" strokeLinecap="round" strokeDasharray={157} strokeDashoffset={157 * (1 - pct / 100)} className="transition-all duration-700" />
            <defs>
              <linearGradient id="achg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-display text-sm font-bold text-white">{pct}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="pa-label !text-[10px]">Ранг коллекционера</div>
          <div className="font-display text-lg font-bold text-white">{rank}</div>
          <div className="text-xs text-amber-200/80">
            {earnedXp} / {TOTAL_XP} XP за награды
          </div>
        </div>
        <Icon name="ChevronRight" size={18} className="text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" />
      </button>

      {recent.length > 0 ? (
        <div className="mb-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Последние</div>
          <div className="flex gap-2">
            {recent.map((a) => (
              <button key={a.id} onClick={() => setOpen(true)} title={`${a.title} · ${RARITY[a.rarity].label}`} className="transition hover:-translate-y-0.5">
                <Medal a={a} unlocked size={40} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass-soft mb-4 p-3 text-center text-xs text-white/50">Заботься о питомце — первые награды не заставят ждать</div>
      )}

      {next.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">Ближайшие цели</div>
          {next.map(({ a, p }) => {
            const r = RARITY[a.rarity];
            const v = Math.min(a.goal, Math.floor(a.value(ctx)));
            return (
              <div key={a.id} className="glass-soft flex items-center gap-3 p-2.5">
                <Medal a={a} unlocked={false} size={38} progress={p} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-white/90">{a.title}</span>
                    <span className={`text-[10px] font-bold ${r.text}`}>+{a.xp}</span>
                  </div>
                  <div className="truncate text-xs text-white/45">{a.desc}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                      <div className={`h-full rounded-full bg-gradient-to-r ${r.grad}`} style={{ width: `${p * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-white/50">
                      {v}/{a.goal}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-white/55 transition hover:bg-white/5 hover:text-white"
      >
        <Icon name="LayoutGrid" size={13} />
        Вся коллекция
      </button>

      <AchievementsDialog open={open} onOpenChange={setOpen} />
    </Panel>
  );
}
