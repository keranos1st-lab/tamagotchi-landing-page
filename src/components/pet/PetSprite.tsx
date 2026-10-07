import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PetType } from '@/store/petStore';
import { CELL_H, CELL_W, PET_SHEETS, type PetAnim } from './sprites';
import { PetFx } from './PetFx';

interface PetSpriteProps {
  type: PetType;
  anim?: PetAnim;
  size?: number;
  className?: string;
  shadow?: boolean;
  fx?: boolean;
  still?: boolean;
  children?: ReactNode;
}

const FLYERS: PetType[] = ['bird', 'dragon'];

const IDLE_MOTION: Record<PetType, string> = {
  cat: 'pm-idle-cat',
  dog: 'pm-idle-dog',
  bird: 'pm-idle-bird',
  owl: 'pm-idle-owl',
  dragon: 'pm-idle-dragon',
  bunny: 'pm-idle-bunny',
  fox: 'pm-idle-fox',
  panda: 'pm-idle-panda',
};

const IDLE_SHADOW: Partial<Record<PetType, string>> = {
  bird: 'pm-sh-bird',
  dragon: 'pm-sh-dragon',
  bunny: 'pm-sh-bunny',
};

const FIDGETS: Record<PetType, string[]> = {
  cat: ['pm-f-tilt', 'pm-f-stretch', 'pm-f-look', 'pm-f-hop'],
  dog: ['pm-f-tilt', 'pm-f-look', 'pm-f-stretch', 'pm-f-shake'],
  bird: ['pm-f-flip', 'pm-f-look', 'pm-f-hop', 'pm-f-tilt'],
  owl: ['pm-f-owl', 'pm-f-look', 'pm-f-owl', 'pm-f-stretch'],
  dragon: ['pm-f-stretch', 'pm-f-shake', 'pm-f-flip', 'pm-f-hop'],
  bunny: ['pm-f-hop', 'pm-f-hop', 'pm-f-look', 'pm-f-shake'],
  fox: ['pm-f-look', 'pm-f-tilt', 'pm-f-stretch', 'pm-f-hop'],
  panda: ['pm-f-tilt', 'pm-f-stretch', 'pm-f-roll', 'pm-f-shake'],
};

function motionFor(type: PetType, anim: PetAnim): { motion: string; shadow: string } {
  const fly = FLYERS.includes(type);
  switch (anim) {
    case 'idle':
      return { motion: IDLE_MOTION[type], shadow: IDLE_SHADOW[type] ?? '' };
    case 'run-right':
      return fly ? { motion: 'pm-fly-r', shadow: 'pm-sh-fly' } : { motion: 'pm-run-r', shadow: 'pm-sh-run' };
    case 'run-left':
      return fly ? { motion: 'pm-fly-l', shadow: 'pm-sh-fly' } : { motion: 'pm-run-l', shadow: 'pm-sh-run' };
    case 'jump':
      return { motion: 'pm-jump', shadow: 'pm-sh-jump' };
    case 'play':
      return type === 'cat' || type === 'dog' ? { motion: '', shadow: '' } : { motion: 'pm-play', shadow: 'pm-sh-play' };
    case 'eat':
      return { motion: 'pm-eat', shadow: '' };
    case 'sleep':
    case 'waiting':
      return { motion: 'pm-sleep', shadow: '' };
    case 'study':
    case 'working':
      return { motion: 'pm-study', shadow: '' };
    case 'wave':
    case 'review':
      return { motion: 'pm-wave', shadow: 'pm-sh-wave' };
    case 'pet':
      return { motion: 'pm-pet', shadow: 'pm-sh-pet' };
    case 'beg':
      return { motion: 'pm-beg', shadow: 'pm-sh-beg' };

    default:
      return { motion: '', shadow: '' };
  }
}

export function PetSprite({ type, anim = 'idle', size = 208, className = '', shadow = true, fx = true, still = false, children }: PetSpriteProps) {
  const cfg = PET_SHEETS[type][anim];
  const [step, setStep] = useState(0);
  const [fidget, setFidget] = useState('');
  const [phase] = useState(() => -Math.random() * 3);

  const seq = useMemo(() => {
    const isRun = anim === 'run-left' || anim === 'run-right';
    if (anim === 'wave') return cfg.frames >= 4 ? [0, 1, 2, 3, 3, 2, 1, 2, 3, 3, 2, 1, 0, 0] : [0];
    if (cfg.cols === 4 && cfg.frames === 4 && !isRun) return [0, 1, 2, 3, 2, 1];
    return Array.from({ length: cfg.frames }, (_, i) => i);
  }, [cfg.frames, cfg.cols, anim]);

  useEffect(() => {
    setStep(0);
    const id = setInterval(() => setStep((s) => (s + 1) % seq.length), 1000 / cfg.fps);
    return () => clearInterval(id);
  }, [type, anim, seq.length, cfg.fps]);

  useEffect(() => {
    setFidget('');
    if (anim !== 'idle') return;
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t1 = setTimeout(() => {
        const list = FIDGETS[type];
        setFidget(list[Math.floor(Math.random() * list.length)]);
        t2 = setTimeout(() => {
          setFidget('');
          schedule();
        }, 1300);
      }, 3500 + Math.random() * 5000);
    };
    schedule();
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [anim, type]);

  const frame = seq[step % seq.length] ?? 0;
  const cw = cfg.cw ?? CELL_W;
  const ch = cfg.ch ?? CELL_H;
  const w = cw * (size / ch);
  const mf = motionFor(type, anim);
  const motion = still ? '' : mf.motion;
  const shadowCls = still ? '' : mf.shadow;
  const isFlyer = FLYERS.includes(type);
  const delay = anim === 'idle' ? `${phase}s` : undefined;

  return (
    <div className={`relative inline-flex items-end justify-center ${className}`} style={{ width: w, height: size }}>
      {shadow && (
        <div
          className={`pm-shadow ${fidget ? '' : shadowCls}`}
          style={{
            width: w * (isFlyer ? 0.42 : 0.5),
            height: Math.max(4, size * 0.06),
            bottom: size * 0.03,
            animationDelay: delay,
          }}
        />
      )}
      <div className={`pm-layer ${motion}`} style={{ animationDelay: delay }}>
        <div className={`pm-layer ${fidget}`}>
          <div key={anim} className="pm-layer pm-enter">
            {children}
            <div
              role="img"
              aria-label="Питомец"
              className={cfg.effect}
              style={{
                width: w,
                height: size,
                backgroundImage: `url(${cfg.src})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${cfg.cols * w}px ${cfg.rows * size}px`,
                backgroundPosition: `${-frame * w}px ${-cfg.row * size}px`,
                position: 'relative',
              }}
            />
          </div>
        </div>
      </div>
      {fx && <PetFx anim={anim} size={size} type={type} />}
    </div>
  );
}
