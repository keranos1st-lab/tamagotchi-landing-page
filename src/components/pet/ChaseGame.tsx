import { useEffect, useRef, useState } from 'react';
import { usePetStore } from '@/store/petStore';
import { PetSprite } from './PetSprite';
import type { PetAnim } from './sprites';

const DURATION = 30;
const PET = 70;
const CATCH_DIST = 34;
const BASE_SPEED = 110;

type Phase = 'intro' | 'play' | 'done';

export function ChaseGame({ onComplete }: { onComplete: () => void }) {
  const type = usePetStore((s) => s.type);
  const { gainExp, play: playStat } = usePetStore();

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

  const reward = Math.min(60, catches * 6 + 5);

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
      gainExp(reward);
      playStat();
    }
  }, [phase, gainExp, playStat, reward]);

  const updateMouse = (clientX: number, clientY: number) => {
    const r = field.current?.getBoundingClientRect();
    if (!r) return;
    mouse.current = { x: clientX - r.left, y: clientY - r.top };
  };

  const start = () => {
    catchesRef.current = 0;
    rewarded.current = false;
    setCatches(0);
    setTimeLeft(DURATION);
    const el = field.current;
    const start = { x: 10, y: el ? el.clientHeight - PET - 10 : 10 };
    posRef.current = start;
    setPos(start);
    stunned.current = performance.now() + 800;
    setPhase('play');
  };

  if (phase === 'done') {
    const verdict =
      catches === 0 ? 'Ты неуловим! Питомец не смог тебя поймать' : catches < 5 ? 'Хорошо бегаешь!' : 'Питомец — настоящий охотник!';
    return (
      <div className="text-center py-6">
        <div className="flex justify-center mb-2">
          <PetSprite type={type} anim={catches > 0 ? 'play' : 'failed'} size={96} />
        </div>
        <p className="text-white text-lg font-bold mb-1">Поймал тебя {catches} раз</p>
        <p className="text-purple-300 text-sm mb-1">{verdict}</p>
        <p className="text-green-400 text-sm mb-4">+{reward} опыта питомцу!</p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={start}
            className="bg-slate-700 text-white px-5 py-2 rounded-lg hover:bg-slate-600 transition"
          >
            Ещё раз
          </button>
          <button
            onClick={onComplete}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2 rounded-lg hover:from-purple-500 hover:to-pink-500 transition"
          >
            Завершить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-purple-200 text-sm">Убегай курсором от питомца!</span>
        <div className="flex gap-3">
          <span className="text-pink-400 text-sm font-bold">Поймал: {catches}</span>
          <span className="text-yellow-400 text-sm font-bold">⏱️ {timeLeft}с</span>
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
        className={`relative h-72 rounded-xl border border-purple-500/20 overflow-hidden touch-none select-none bg-gradient-to-br from-emerald-900/30 via-slate-900/60 to-indigo-900/40 ${
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
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-sm font-bold text-pink-300 animate-fadeIn"
            style={{ left: flash.x, top: flash.y - 10 }}
          >
            Поймал!
          </div>
        )}

        {phase === 'intro' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 text-center p-4">
            <p className="text-white font-bold mb-1">Догонялки</p>
            <p className="text-purple-200 text-sm mb-4 max-w-xs">
              Питомец гоняется за курсором 30 секунд. С каждой поимкой он бегает быстрее. Чем больше поймает — тем больше опыта!
            </p>
            <button
              onClick={start}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg hover:from-purple-500 hover:to-pink-500 transition"
            >
              Старт!
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
