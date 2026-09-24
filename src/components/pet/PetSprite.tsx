import { useEffect, useState } from 'react';
import type { PetType } from '@/store/petStore';
import { CELL_H, CELL_W, PET_SHEETS, type PetAnim } from './sprites';

interface PetSpriteProps {
  type: PetType;
  anim?: PetAnim;
  size?: number;
  className?: string;
}

export function PetSprite({ type, anim = 'idle', size = 208, className = '' }: PetSpriteProps) {
  const cfg = PET_SHEETS[type][anim];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    const id = setInterval(() => setFrame((f) => (f + 1) % cfg.frames), 1000 / cfg.fps);
    return () => clearInterval(id);
  }, [type, anim, cfg.frames, cfg.fps]);

  const w = CELL_W * (size / CELL_H);
  const showZ = anim === 'sleep' || anim === 'waiting';

  return (
    <div className={`relative inline-flex items-end justify-center ${className}`}>
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
          backgroundPosition: `${-(frame % cfg.frames) * w}px ${-cfg.row * size}px`,
        }}
      />
      {showZ && (
        <span className="absolute -top-2 right-0 text-xl font-bold text-sky-300 animate-pulse select-none">Zzz</span>
      )}
    </div>
  );
}
