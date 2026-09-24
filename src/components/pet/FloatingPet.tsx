import { useEffect, useRef, useState } from 'react';
import { usePetStore } from '@/store/petStore';
import Icon from '@/components/ui/icon';
import { PetSprite } from './PetSprite';
import type { PetAnim } from './sprites';
import { getPipApi, openPipWindow, PipPortal } from './PipWindow';
import { needAnim, PetEmotion, usePetNeed } from './PetEmotion';
import { PetActionPill, PillButton } from './PetActionPill';

const SIZE = 120;
const SPEED = 90;

function WalkingPet({ onOpenPip, onHide, canPip }: { onOpenPip: () => void; onHide: () => void; canPip: boolean }) {
  const type = usePetStore((s) => s.type);
  const name = usePetStore((s) => s.name);
  const need = usePetNeed();
  const moodAnim = needAnim(need);

  const [x, setX] = useState(() => window.innerWidth - SIZE - 40);
  const [y, setY] = useState(0);
  const [anim, setAnim] = useState<PetAnim>('idle');
  const [hover, setHover] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);

  const target = useRef<number | null>(null);
  const drag = useRef<{ dx: number; dy: number; lastX: number } | null>(null);
  const special = useRef<number>(0);
  const xRef = useRef(x);
  xRef.current = x;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!drag.current && target.current !== null && special.current < t) {
        const cur = xRef.current;
        const diff = target.current - cur;
        if (Math.abs(diff) < 4) {
          target.current = null;
          setAnim('idle');
        } else {
          const step = Math.sign(diff) * Math.min(Math.abs(diff), SPEED * dt);
          setX(cur + step);
          setAnim(diff > 0 ? 'run-right' : 'run-left');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (drag.current || target.current !== null || special.current > performance.now() || hover) return;
      if (Math.random() < 0.55) {
        target.current = 20 + Math.random() * Math.max(0, window.innerWidth - SIZE - 40);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [hover]);

  useEffect(() => {
    const onResize = () => setX((v) => Math.min(v, window.innerWidth - SIZE - 10));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const playOnce = (a: PetAnim, ms: number, text?: string) => {
    target.current = null;
    special.current = performance.now() + ms;
    setAnim(a);
    if (text) setBubble(text);
    setTimeout(() => {
      setAnim('idle');
      setBubble(null);
    }, ms);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - x, dy: e.clientY, lastX: e.clientX };
    target.current = null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const nx = Math.max(0, Math.min(window.innerWidth - SIZE, e.clientX - d.dx));
    const ny = Math.max(0, Math.min(window.innerHeight - SIZE - 20, d.dy - e.clientY + y));
    if (Math.abs(e.clientX - d.lastX) > 1) setAnim(e.clientX > d.lastX ? 'run-right' : 'run-left');
    d.lastX = e.clientX;
    d.dy = e.clientY;
    setX(nx);
    setY(ny);
  };

  const onPointerUp = () => {
    const wasDragged = y > 4 || anim.startsWith('run');
    drag.current = null;
    if (y > 0) {
      setY(0);
      playOnce('jump', 700);
    } else if (!wasDragged) {
      playOnce('wave', 1500, `Привет! Я ${name}`);
    } else {
      setAnim('idle');
    }
  };

  const shownAnim: PetAnim = anim === 'idle' && moodAnim ? moodAnim : anim;

  return (
    <div
      className="fixed z-[60] select-none"
      style={{ left: x, bottom: 44 + y, width: SIZE, transition: drag.current ? 'none' : 'bottom 0.35s cubic-bezier(.5,0,.8,.4)' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {bubble && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-lg animate-fadeIn">
          {bubble}
        </div>
      )}
      {!bubble && !hover && <PetEmotion need={need} compact />}
      {hover && !bubble && (
        <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 z-10 animate-fadeIn">
          <PetActionPill
            onAction={(a) => playOnce(a, 2400)}
            extra={
              <>
                {canPip && (
                  <PillButton title="Открыть поверх всех окон" icon="PictureInPicture2" onClick={onOpenPip} />
                )}
                <PillButton title="Спрятать" icon="EyeOff" onClick={onHide} />
              </>
            }
          />
        </div>
      )}
      <div
        className="cursor-grab active:cursor-grabbing touch-none drop-shadow-[0_8px_12px_rgba(0,0,0,0.35)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <PetSprite type={type} anim={shownAnim} size={SIZE} />
      </div>
    </div>
  );
}

function PipPet() {
  const type = usePetStore((s) => s.type);
  const need = usePetNeed();
  const [anim, setAnim] = useState<PetAnim | null>(null);
  const [hover, setHover] = useState(false);

  const play = (a: PetAnim) => {
    setAnim(a);
    setTimeout(() => setAnim(null), 2400);
  };

  return (
    <div
      className="relative h-screen w-full overflow-hidden flex flex-col items-center justify-center select-none"
      style={{ background: 'radial-gradient(circle at 50% 60%, #312e81 0%, #1e1b4b 55%, #0f0d2e 100%)' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="relative mt-4">
        <PetEmotion need={need} />
        <button onClick={() => play('wave')} className="focus:outline-none">
          <PetSprite type={type} anim={anim ?? needAnim(need) ?? 'idle'} size={130} />
        </button>
      </div>
      <div className={`mt-1 transition-opacity ${hover ? 'opacity-100' : 'opacity-0'}`}>
        <PetActionPill onAction={play} />
      </div>
    </div>
  );
}

export function FloatingPet() {
  const [visible, setVisible] = useState(true);
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const canPip = !!getPipApi();

  const openPip = async () => {
    const win = await openPipWindow(220, 230);
    if (!win) return;
    win.addEventListener('pagehide', () => setPipWin(null));
    setPipWin(win);
  };

  const closePip = () => {
    pipWin?.close();
    setPipWin(null);
  };

  return (
    <>
      {pipWin && (
        <PipPortal win={pipWin}>
          <PipPet />
        </PipPortal>
      )}

      {!pipWin && visible && <WalkingPet canPip={canPip} onOpenPip={openPip} onHide={() => setVisible(false)} />}

      <div className="fixed right-4 top-20 z-[61] flex flex-col gap-2">
        {!pipWin && !visible && (
          <button
            onClick={() => setVisible(true)}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white shadow-lg hover:bg-purple-500"
          >
            <Icon name="PawPrint" size={14} /> Выпустить питомца
          </button>
        )}
        {!pipWin && canPip && (
          <button
            onClick={openPip}
            className="flex items-center gap-2 rounded-xl bg-slate-800/90 border border-purple-500/30 px-3 py-2 text-xs font-semibold text-purple-100 shadow-lg hover:bg-slate-700"
          >
            <Icon name="PictureInPicture2" size={14} /> Поверх всех окон
          </button>
        )}
        {pipWin && (
          <button
            onClick={closePip}
            className="flex items-center gap-2 rounded-xl bg-slate-800/90 border border-purple-500/30 px-3 py-2 text-xs font-semibold text-purple-100 shadow-lg hover:bg-slate-700"
          >
            <Icon name="Undo2" size={14} /> Вернуть питомца на сайт
          </button>
        )}
      </div>
    </>
  );
}