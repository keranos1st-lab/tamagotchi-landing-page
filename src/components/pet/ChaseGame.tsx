import { useEffect, useRef, useState } from 'react';
import { usePetStore } from '@/store/petStore';
import { PetSprite } from './PetSprite';
import type { PetAnim } from './sprites';
import Icon from '@/components/ui/icon';
import { GameResult } from './ui';
import { sfx } from './sound';
import { track } from '@/store/achievementStore';
import { rewardLabel, chaseReward, canStartGame } from './gameLogic';

const DURATION = 30;
const PET = 70;
const CATCH_DIST = 34;
const BASE_SPEED = 110;

type Phase = 'intro' | 'play' | 'done';

export function ChaseGame({ onComplete }: { onComplete: () => void }) {
  const type = usePetStore((s) => s.type);
  const playedGame = usePetStore((s) => s.playedGame);
  const energy = usePetStore((s) => s.energy);
  const [gained, setGained] = useState<number | null>(null);

  const [phase, setPhase] = useState<Phase>('intro');
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [catches, setCatches] = useState(0);
  const [pos, setPos] = useState({ x: 20, y: 20 });
  const [anim, setAnim] = useState<PetAnim>('idle');
  const [flash, setFlash] = useState<{ x: number; y: number; id: number } | null>(null);
  const [inside, setInside] = useState(false);

  const field = useRef<HTMLDivElement>(null);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const posRef = useRef(pos);
  const stunned = useRef(0);
  const catchesRef = useRef(0);
  const rewarded = useRef(false);


  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setPhase('done');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'play') return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const m = mouse.current;
      const el = field.current;
      if (m && el && t > stunned.current) {
        const p = posRef.current;
        const cx = p.x + PET / 2;
        const cy = p.y + PET / 2;
        const dx = m.x - cx;
        const dy = m.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < CATCH_DIST) {
          catchesRef.current += 1;
          setCatches(catchesRef.current);
          sfx.jump();
          setFlash({ x: m.x, y: m.y, id: t });
          setAnim(Math.random() < 0.5 ? 'jump' : 'wave');
          stunned.current = t + 900;
          const w = el.clientWidth;
          const h = el.clientHeight;
          const nx = m.x < w / 2 ? w - PET - 8 : 8;
          const ny = m.y < h / 2 ? h - PET - 8 : 8;
          setTimeout(() => {
            posRef.current = { x: nx, y: ny };
            setPos(posRef.current);
          }, 700);
        } else {
          const speed = BASE_SPEED + catchesRef.current * 18;
          const k = Math.min(1, (speed * dt) / dist);
          const next = {
            x: Math.max(0, Math.min(el.clientWidth - PET, p.x + dx * k)),
            y: Math.max(0, Math.min(el.clientHeight - PET, p.y + dy * k)),
          };
          posRef.current = next;
          setPos(next);
          setAnim(dx >= 0 ? 'run-right' : 'run-left');
        }
      } else if (!m && t > stunned.current) {
        setAnim('idle');
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase === 'done' && !rewarded.current) {
      rewarded.current = true;
      const c = catchesRef.current;
      if (c <= 2) sfx.win();
      else sfx.lose();
      setGained(playedGame('chase', chaseReward(c)));
      track.game('chase');
      if (c === 0) track.win();
    }
  }, [phase, playedGame]);

  const updateMouse = (clientX: number, clientY: number) => {
    const r = field.current?.getBoundingClientRect();
    if (!r) return;
    mouse.current = { x: clientX - r.left, y: clientY - r.top };
  };

  const start = () => {
    if (!canStartGame(usePetStore.getState().energy)) return;
    catchesRef.current = 0;
    rewarded.current = false;
    setGained(null);
    setCatches(0);
    setTimeLeft(DURATION);
    const el = field.current;
    const start = { x: 10, y: el ? el.clientHeight - PET - 10 : 10 };
    posRef.current = start;
    setPos(start);
    stunned.current = performance.now() + 800;
    setPhase('play');
    sfx.pop();
  };

  if (phase === 'done') {
    const verdict =
      catches === 0 ? 'Ты неуловим! Питомец не смог тебя поймать' : catches <= 3 ? 'Хорошо бегаешь!' : 'Питомец оказался быстрее — попробуй ещё';
    return (
      <GameResult
        pet={<PetSprite type={type} anim={catches > 3 ? 'play' : 'failed'} size={110} />}
        title={catches === 0 ? 'Ни разу не пойман!' : `Пойман ${catches} раз`}
        subtitle={verdict}
        reward={rewardLabel(gained)}
        onAgain={canStartGame(energy) ? start : undefined}
        onExit={onComplete}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-white/55">Убегай курсором от питомца!</span>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-extrabold tabular-nums text-pink-300">
            <Icon name="Hand" size={14} />
            {catches}
          </div>
          <div className={`flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-extrabold tabular-nums ${timeLeft <= 5 && phase === 'play' ? 'text-rose-400 animate-pulse' : 'text-amber-300'}`}>
            <Icon name="Timer" size={14} />
            {timeLeft}с
          </div>
        </div>
      </div>

      <div
        ref={field}
        onMouseMove={(e) => updateMouse(e.clientX, e.clientY)}
        onMouseEnter={() => setInside(true)}
        onMouseLeave={() => {
          mouse.current = null;
          setInside(false);
        }}
        onTouchMove={(e) => updateMouse(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={() => (mouse.current = null)}
        className={`pa-field pa-field-grid relative h-80 touch-none select-none ${
          phase === 'play' ? 'cursor-crosshair' : ''
        }`}
      >
        <div
          className="absolute"
          style={{ left: pos.x, top: pos.y, width: PET, height: PET, transition: 'none' }}
        >
          <PetSprite type={type} anim={phase === 'play' ? anim : 'wave'} size={PET} />
        </div>

        {flash && (
          <div
            key={flash.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-full bg-pink-500 px-2.5 py-0.5 text-xs font-extrabold text-white shadow-[0_0_20px_rgba(236,72,153,0.8)] pa-pop"
            style={{ left: flash.x, top: flash.y - 10 }}
          >
            Поймал!
          </div>
        )}

        {phase === 'intro' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07061a]/70 backdrop-blur-sm text-center p-4">
            <p className="font-display text-2xl font-bold text-white mb-2">Готов бежать?</p>
            <p className="text-white/60 text-sm mb-5 max-w-xs">
              Питомец 30 секунд гоняется за курсором и с каждой поимкой бегает быстрее. Чем реже он тебя поймает — тем больше опыта!
            </p>
            <button onClick={start} className="btn-neon pa-shine">
              <Icon name="Play" size={16} />
              Старт
            </button>
          </div>
        )}

        {phase === 'play' && !inside && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-purple-300">
            Наведи курсор на поле
          </div>
        )}
      </div>
    </div>
  );
}
