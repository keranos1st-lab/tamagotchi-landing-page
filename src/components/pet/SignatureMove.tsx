import { useEffect, useRef, useState } from 'react';
import type { PetType } from '@/store/petStore';
import { PetSprite } from './PetSprite';
import { PET_SHEETS, CELL_H, CELL_W, type PetAnim } from './sprites';
import { SIGNATURES } from './signature';

type Step = { anim: PetAnim; ms: number; cls?: string; fx?: string };

const SCRIPTS: Record<PetType, Step[]> = {
  cat: [
    { anim: 'idle', ms: 450, cls: 'sm-crouch' },
    { anim: 'trick', ms: 2600, cls: 'sm-laptop', fx: 'code' },
    { anim: 'trick', ms: 700, cls: 'sm-proud', fx: 'check' },
    { anim: 'wave', ms: 500 },
  ],
  dog: [
    { anim: 'idle', ms: 400, cls: 'sm-crouch' },
    { anim: 'trick', ms: 1500, cls: 'sm-wag' },
    { anim: 'trick', ms: 700, cls: 'sm-proud' },
  ],
  fox: [
    { anim: 'idle', ms: 500, cls: 'sm-sniff', fx: 'puff' },
    { anim: 'trick', ms: 1100, cls: 'sm-wag' },
    { anim: 'run-right', ms: 300, cls: 'sm-circle-a' },
    { anim: 'run-left', ms: 300, cls: 'sm-circle-b' },
    { anim: 'run-right', ms: 300, cls: 'sm-circle-a', fx: 'dizzy' },
    { anim: 'trick', ms: 800, cls: 'sm-dizzy', fx: 'dizzy' },
  ],
  dragon: [
    { anim: 'trick', ms: 2400 },
  ],
  bunny: [
    { anim: 'trick', ms: 700, cls: 'sm-crouch' },
    { anim: 'trick', ms: 400, cls: 'sm-hop-hi' },
    { anim: 'trick', ms: 400, cls: 'sm-hop-hi' },
    { anim: 'trick', ms: 400, cls: 'sm-hop-hi' },
    { anim: 'wave', ms: 700, cls: 'sm-land', fx: 'sparkle' },
  ],
  panda: [
    { anim: 'eat', ms: 1600, cls: 'sm-munch', fx: 'leaf' },
    { anim: 'trick', ms: 900, cls: 'sm-munch' },
    { anim: 'sleep', ms: 900, cls: 'sm-yawn', fx: 'zz' },
  ],
  owl: [
    { anim: 'run-left', ms: 600, cls: 'sm-look' },
    { anim: 'run-right', ms: 600, cls: 'sm-look' },
    { anim: 'trick', ms: 1000, cls: 'sm-hover' },
    { anim: 'study', ms: 1100, cls: 'sm-ponder', fx: 'idea' },
  ],
  bird: [
    { anim: 'trick', ms: 900, cls: 'sm-hover' },
    { anim: 'play', ms: 900, cls: 'sm-sing', fx: 'notes' },
    { anim: 'trick', ms: 900, cls: 'sm-sing', fx: 'notes' },
    { anim: 'wave', ms: 500 },
  ],
};

export const signatureDuration = (type: PetType) => SCRIPTS[type].reduce((s, x) => s + x.ms, 0);

const MOUTH: Partial<Record<PetType, { x: number; y: number }>> = {
  dragon: { x: 75, y: 52 },
};

export function SignatureMove({ type, size, onDone }: { type: PetType; size: number; onDone?: () => void }) {
  const script = SCRIPTS[type];
  const [i, setI] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    setI(0);
    let idx = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        idx += 1;
        if (idx >= script.length) {
          done.current?.();
          return;
        }
        setI(idx);
        next();
      }, script[idx].ms);
    };
    next();
    return () => clearTimeout(t);
  }, [type, script]);

  const step = script[Math.min(i, script.length - 1)];
  const idle = PET_SHEETS[type].idle;
  const w = Math.max(...script.map((s) => PET_SHEETS[type][s.anim].cw ?? CELL_W)) * (size / (idle.ch ?? CELL_H));
  const mouth = MOUTH[type];

  return (
    <div className="relative" style={{ width: w, height: size }} aria-label={SIGNATURES[type].label}>
      <div key={i} className={`sm-layer text-center ${step.cls ?? ''}`} style={{ animationDuration: `${step.ms}ms` }}>
        <PetSprite type={type} anim={step.anim} size={size} fx={false} still={step.fx === 'fire'}>
          {step.fx === 'fire' && mouth && (
            <div className="pointer-events-none absolute" style={{ left: `${mouth.x}%`, top: `${mouth.y}%` }}>
              <span className="sm-fire-glow" style={{ width: size * 0.62, height: size * 0.2 }} />
              <span className="sm-fire-core" style={{ width: size * 0.55, height: size * 0.11 }} />
              {Array.from({ length: 6 }).map((_, k) => (
                <span
                  key={k}
                  className="sm-ember"
                  style={{ animationDelay: `${k * 0.15}s`, ['--ty' as string]: `${(k % 3 - 1) * size * 0.05}px`, width: size * 0.022, height: size * 0.022 }}
                />
              ))}
            </div>
          )}
        </PetSprite>
      </div>

      {step.fx === 'smoke' && mouth && (
        <div className="pointer-events-none absolute" style={{ left: `${mouth.x}%`, top: `${mouth.y - 4}%` }}>
          {[0, 1, 2].map((k) => (
            <span key={k} className="sm-smoke" style={{ animationDelay: `${k * 0.12}s`, width: size * 0.1, height: size * 0.1 }} />
          ))}
        </div>
      )}

      {step.fx === 'throw' && <span className="sm-ball sm-ball-throw" style={{ width: size * 0.1, height: size * 0.1 }} />}
      {step.fx === 'carry' && (
        <span className="sm-ball sm-ball-carry" style={{ width: size * 0.1, height: size * 0.1, left: '22%', top: '55%' }} />
      )}
      {step.fx === 'drop' && <span className="sm-ball sm-ball-drop" style={{ width: size * 0.1, height: size * 0.1 }} />}

      {step.fx === 'puff' &&
        [0, 1].map((k) => (
          <span key={k} className="sm-puff-cloud" style={{ left: `${k ? 64 : 22}%`, top: '52%', animationDelay: `${k * 0.28}s`, width: size * 0.12, height: size * 0.12 }} />
        ))}
      {step.fx === 'dizzy' && (
        <div className="sm-dizzy-ring" style={{ width: size * 0.5, height: size * 0.14, top: '18%' }}>
          {['★', '✦', '★'].map((c, k) => (
            <span key={k} style={{ animationDelay: `${-k * 0.33}s`, fontSize: size * 0.08 }}>
              {c}
            </span>
          ))}
        </div>
      )}

      {step.fx === 'notes' &&
        ['♪', '♫', '♪', '♬', '♫'].map((n, k) => (
          <span
            key={k}
            className="sm-note"
            style={{ animationDelay: `${k * 0.3}s`, fontSize: size * 0.12, left: `${55 + (k % 2) * 18}%`, top: '30%', color: ['#67e8f9', '#f472b6', '#fde047', '#a78bfa', '#86efac'][k] }}
          >
            {n}
          </span>
        ))}
      {step.fx === 'leaf' &&
        [0, 1, 2].map((k) => (
          <span key={k} className="sm-leaf" style={{ animationDelay: `${k * 0.55}s`, fontSize: size * 0.08, left: `${40 + k * 8}%`, top: '58%' }}>
            🍃
          </span>
        ))}
      {step.fx === 'zz' && (
        <span className="sm-zz" style={{ fontSize: size * 0.11, left: '64%', top: '20%' }}>
          z<small>z</small>
        </span>
      )}
      {step.fx === 'idea' && (
        <span className="sm-idea" style={{ fontSize: size * 0.14, left: '62%', top: '8%' }}>
          💡
        </span>
      )}
      {step.fx === 'code' &&
        ['</>', '{ }', '=>'].map((c, k) => (
          <span key={k} className="sm-code" style={{ animationDelay: `${k * 0.45}s`, fontSize: size * 0.08, left: `${20 + k * 25}%`, top: '14%' }}>
            {c}
          </span>
        ))}
      {step.fx === 'check' && (
        <span className="sm-check" style={{ fontSize: size * 0.14, left: '64%', top: '6%' }}>
          ✓
        </span>
      )}
      {step.fx === 'sparkle' &&
        [0, 1, 2, 3].map((k) => (
          <span key={k} className="sm-spark" style={{ left: `${15 + k * 22}%`, bottom: '4%', animationDelay: `${k * 0.06}s`, fontSize: size * 0.07 }}>
            ✦
          </span>
        ))}
    </div>
  );
}
