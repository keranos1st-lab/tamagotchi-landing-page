import { useEffect, useState } from 'react';
import { PetSprite } from './PetSprite';
import { ACTION_ANIM, type PetAnim } from './sprites';
import { FloatingPet } from './FloatingPet';
import { needAnim, PetEmotion, usePetNeed } from './PetEmotion';
import { usePetNotifications } from './useNotifications';
import { usePetting } from './usePetting';
import { LevelUpModal } from './LevelUpModal';
import { useWantsCuddle } from './useCuddle';
import { usePetStore } from '@/store/petStore';
import { useThinkingStore } from '@/store/thinkingStore';
import { track } from '@/store/achievementStore';
import { ThinkFxLayer, thinkingAnim } from './thinking';
import { PetSelection } from './PetSelection';
import { PetActions } from './PetActions';
import { PetStats } from './PetStats';
import { PetChat } from './PetChat';
import { PetHeader } from './PetHeader';
import { sfx, signatureSfx } from './sound';
import { pickBubble } from './signature';
import { SignatureMove, signatureDuration } from './SignatureMove';
import { MiniGames } from './MiniGames';
import { Achievements } from './Achievements';
import { AchievementToast } from './achievements/AchievementToast';
import { useAchievementWatcher } from './achievements/useAchievements';
import Icon from '@/components/ui/icon';

import type { ActionType } from './sprites';

type Tab = 'actions' | 'games' | 'chat';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'actions', label: 'Уход', icon: 'Heart' },
  { id: 'games', label: 'Игры', icon: 'Gamepad2' },
  { id: 'chat', label: 'AI-чат', icon: 'MessageCircle' },
];

const STARS = Array.from({ length: 18 }).map((_, i) => ({
  left: (i * 47) % 100,
  top: (i * 29) % 90,
  delay: (i % 6) * 0.5,
}));

export function GameScreen() {
  const { hasSelectedPet, hunger, happiness, energy, health, type, level, stage, intelligence } = usePetStore();
  useAchievementWatcher();
  const [activeTab, setActiveTab] = useState<Tab>('actions');
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [sigBubble, setSigBubble] = useState<string | null>(null);
  const [sigKey, setSigKey] = useState(0);
  const need = usePetNeed();
  usePetNotifications();
  const petting = usePetting();
  const wantsCuddle = useWantsCuddle();

  useEffect(() => {
    const advance = () => usePetStore.getState().advance();
    advance();
    const interval = setInterval(advance, 5000);
    const onVisible = () => document.visibilityState === 'visible' && advance();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', advance);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', advance);
    };
  }, []);

  useEffect(() => {
    if (currentAction) {
      const timer = setTimeout(() => {
        setCurrentAction(null);
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [currentAction]);

  const thinking = useThinkingStore((s) => s.thinking);
  const celebrate = useThinkingStore((s) => s.celebrate);
  const [cheering, setCheering] = useState(false);
  useEffect(() => {
    if (!celebrate) return;
    setCheering(true);
    const t = setTimeout(() => setCheering(false), 1600);
    return () => clearTimeout(t);
  }, [celebrate]);

  if (!hasSelectedPet) {
    return <PetSelection />;
  }

  const mood = getMood(hunger, happiness, energy, health);
  const doSignature = () => {
    if (sigBubble) return;
    setCurrentAction(null);
    setSigKey((k) => k + 1);
    setSigBubble(pickBubble(type));
    signatureSfx(type);
    track.bump('tricks');
    setTimeout(() => setSigBubble(null), signatureDuration(type));
  };

  const anim: PetAnim = sigBubble ? 'special' : thinking ? (need === 'tired' ? 'sleep' : thinkingAnim(type)) : cheering ? (need === 'tired' || need === 'sick' ? 'wave' : 'jump') : currentAction ? ACTION_ANIM[currentAction] : petting.petting ? 'pet' : wantsCuddle ? 'beg' : needAnim(need) ?? 'idle';
  const spriteSize = stage === 'adult' ? 300 : stage === 'teen' ? 270 : 240;
  const stageLabel = stage === 'adult' ? 'Взрослый' : stage === 'teen' ? 'Подросток' : 'Малыш';

  return (
    <div className="pa-app flex flex-col">
      <FloatingPet />
      <LevelUpModal />
      <AchievementToast />
      <PetHeader />

      <main className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-[280px_1fr]">
        <aside className="order-2 space-y-4 lg:order-1">
          <PetStats />
          <Achievements />
        </aside>

        <section className="order-1 flex flex-col gap-4 lg:order-2 min-w-0">
          <div className="pa-stage min-h-[380px] sm:min-h-[440px]">
            <div className="pa-orbit h-[340px] w-[340px]" />
            <div className="pa-orbit h-[520px] w-[520px] opacity-60" style={{ animationDirection: 'reverse' }} />
            {STARS.map((s, i) => (
              <span
                key={i}
                className="pa-star"
                style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }}
              />
            ))}
            <div className="pa-floor" />

            <div className="absolute left-4 top-4 right-4 z-20 flex flex-wrap items-start justify-between gap-2">
              <div className="glass !rounded-2xl px-3.5 py-2.5">
                <div className="pa-label !text-[10px]">Настроение</div>
                <div className="mt-0.5 flex items-center gap-2 text-sm font-extrabold text-white">
                  <span className={`h-2 w-2 rounded-full ${mood.dot}`} />
                  {mood.label}
                </div>
              </div>
              <div className="flex gap-2">
                <div className="glass !rounded-2xl px-3.5 py-2.5 text-right">
                  <div className="pa-label !text-[10px]">Стадия</div>
                  <div className="mt-0.5 text-sm font-extrabold text-white">{stageLabel}</div>
                </div>
                <div className="glass !rounded-2xl px-3.5 py-2.5 text-right">
                  <div className="pa-label !text-[10px]">IQ</div>
                  <div className="mt-0.5 text-sm font-extrabold text-cyan-300 tabular-nums">{Math.round(intelligence)}</div>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-[9%] z-10 flex justify-center">
              <div className="relative">
                {!sigBubble && !currentAction && !petting.petting && !petting.bubble && !wantsCuddle && <PetEmotion need={need} />}
                {!sigBubble && !currentAction && !petting.petting && !petting.bubble && wantsCuddle && (
                  <div className="pointer-events-none absolute -top-4 left-1/2 z-20 -translate-x-1/2 pa-pop">
                    <div className="relative whitespace-nowrap rounded-2xl bg-white px-3.5 py-1.5 text-sm font-extrabold text-pink-600 ring-2 ring-pink-300/60 shadow-[0_10px_30px_-10px_rgba(236,72,153,0.8)]">
                      Я соскучился… погладь меня!
                      <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" />
                    </div>
                  </div>
                )}
                {sigBubble && !petting.bubble && (
                  <div key={sigBubble + sigKey} className="pointer-events-none absolute -top-4 left-1/2 z-20 -translate-x-1/2 pa-pop">
                    <div className="relative whitespace-nowrap rounded-2xl bg-white px-3.5 py-1.5 text-sm font-extrabold text-violet-700 shadow-[0_10px_30px_-10px_rgba(139,92,246,0.8)]">
                      {sigBubble}
                      <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" />
                    </div>
                  </div>
                )}
                {petting.bubble && (
                  <div key={petting.bubble} className="pointer-events-none absolute -top-4 left-1/2 z-20 -translate-x-1/2 pa-pop">
                    <div className="relative whitespace-nowrap rounded-2xl bg-white px-3.5 py-1.5 text-sm font-extrabold text-pink-600 shadow-[0_10px_30px_-10px_rgba(236,72,153,0.8)]">
                      {petting.bubble}
                      <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" />
                    </div>
                  </div>
                )}
                <div
                  {...petting.handlers}
                  className="relative cursor-grab touch-none select-none active:cursor-grabbing"
                  title="Погладь меня!"
                >
                  {anim === 'special' ? (
                    <SignatureMove key={sigKey} type={type} size={spriteSize} />
                  ) : (
                    <PetSprite type={type} anim={anim} size={spriteSize}>
                      {thinking && !sigBubble && <ThinkFxLayer type={type} size={spriteSize} />}
                    </PetSprite>
                  )}
                  {petting.hearts.map((h) => (
                    <span
                      key={h.id}
                      className="pet-trail-heart"
                      style={{ left: `${h.x}%`, top: `${h.y}%` }}
                    >
                      ❤
                    </span>
                  ))}
                </div>
                {petting.love > 0 && (
                  <div className="absolute -bottom-3 left-1/2 w-28 -translate-x-1/2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-500 shadow-[0_0_10px_rgba(244,114,182,0.8)] transition-all duration-300"
                        style={{ width: `${petting.love}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/30 border border-white/10 px-3 py-1 text-[11px] font-semibold text-white/60 backdrop-blur">
              <Icon name="Hand" size={12} />
              {petting.love >= 100 ? 'Питомец на седьмом небе!' : 'Погладь — води мышкой по питомцу'} · Ур. {level}
            </div>
          </div>

          <div className="glass !rounded-2xl p-1.5 flex gap-1">
            {TABS.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTab(t.id);
                    sfx.click();
                  }}
                  className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-extrabold transition-all ${
                    active
                      ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-[0_8px_24px_-8px_rgba(236,72,153,0.7)]'
                      : 'text-white/55 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon name={t.icon} size={16} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div key={activeTab} className="pa-rise">
            {activeTab === 'actions' && <PetActions onAction={setCurrentAction} onSignature={doSignature} />}
            {activeTab === 'games' && <MiniGames />}
            {activeTab === 'chat' && <PetChat />}
          </div>
        </section>
      </main>
    </div>
  );
}

function getMood(hunger: number, happiness: number, energy: number, health: number) {
  const avg = (hunger + happiness + energy + health) / 4;
  if (avg > 80) return { label: 'Счастлив', dot: 'bg-emerald-400 shadow-[0_0_10px_#34d399]' };
  if (avg > 60) return { label: 'Доволен', dot: 'bg-lime-300 shadow-[0_0_10px_#bef264]' };
  if (avg > 40) return { label: 'Нормально', dot: 'bg-amber-300 shadow-[0_0_10px_#fcd34d]' };
  if (avg > 20) return { label: 'Грустит', dot: 'bg-orange-400 shadow-[0_0_10px_#fb923c]' };
  return { label: 'Плохо', dot: 'bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-pulse' };
}
