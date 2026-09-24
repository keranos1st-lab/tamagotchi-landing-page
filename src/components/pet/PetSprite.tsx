import { useEffect, useState } from 'react';
import type { PetType } from '@/store/petStore';
import { PET_IMAGES, SHEET, SHEET_ROWS, type PetAnim } from './sprites';

interface PetSpriteProps {
  type: PetType;
  anim?: PetAnim;
  size?: number;
  className?: string;
}

function SheetSprite({ anim, size }: { anim: PetAnim; size: number }) {
  const cfg = SHEET_ROWS[anim];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    const id = setInterval(() => setFrame((f) => (f + 1) % cfg.frames), 1000 / cfg.fps);
    return () => clearInterval(id);
  }, [anim, cfg.frames, cfg.fps]);

  const scale = size / SHEET.cellH;
  const w = SHEET.cellW * scale;

  return (
    <div
      role="img"
      aria-label="Питомец"
      style={{
        width: w,
        height: size,
        backgroundImage: `url(${SHEET.src})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${SHEET.cols * w}px ${SHEET.rows * size}px`,
        backgroundPosition: `${-frame * w}px ${-cfg.row * size}px`,
        imageRendering: 'auto',
      }}
    />
  );
}

const IMAGE_ANIM_CLASS: Record<PetAnim, string> = {
  idle: 'pet-anim-idle',
  'run-right': 'pet-anim-run',
  'run-left': 'pet-anim-run',
  wave: 'pet-anim-wave',
  jump: 'pet-anim-jump',
  failed: 'pet-anim-failed',
  waiting: 'pet-anim-sleep',
  working: 'pet-anim-work',
  review: 'pet-anim-happy',
};

function ImageSprite({ src, anim, size }: { src: string; anim: PetAnim; size: number }) {
  return (
    <div style={{ width: size * 0.93, height: size }} className="flex items-end justify-center">
      <div style={{ transform: anim === 'run-left' ? 'scaleX(-1)' : undefined }} className="w-full h-full">
        <img
          src={src}
          alt="Питомец"
          draggable={false}
          className={`w-full h-full object-contain select-none ${IMAGE_ANIM_CLASS[anim]}`}
          style={{ transformOrigin: '50% 100%' }}
        />
      </div>
    </div>
  );
}

export function PetSprite({ type, anim = 'idle', size = 208, className = '' }: PetSpriteProps) {
  const img = PET_IMAGES[type];
  return (
    <div className={`relative inline-flex items-end justify-center ${className}`}>
      {img ? <ImageSprite src={img} anim={anim} size={size} /> : <SheetSprite anim={anim} size={size} />}
      {anim === 'waiting' && (
        <span className="absolute -top-2 right-0 text-xl font-bold text-sky-300 animate-pulse select-none">Zzz</span>
      )}
    </div>
  );
}
