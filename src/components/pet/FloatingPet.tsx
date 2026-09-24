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

type Pt = { x: number; y: number };

const clampPos = (p: Pt): Pt => ({
  x: Math.max(4, Math.min(window.innerWidth - SIZE - 4, p.x)),
  y: Math.max(40, Math.min(window.innerHeight - SIZE - 48, p.y)),
});

const randomPoint = (from: Pt): Pt => {
  const maxDist = Math.min(window.innerWidth, window.innerHeight) * 0.6;
  const ang = Math.random() * Math.PI * 2;
  const dist = 120 + Math.random() * maxDist;
  return clampPos({ x: from.x + Math.cos(ang) * dist, y: from.y + Math.sin(ang) * dist });
};

function WalkingPet({ onOpenPip, onHide, canPip }: { onOpenPip: () => void; onHide: () => void; canPip: boolean }) {
  const type = usePetStore((s) => s.type);
  const name = usePetStore((s) => s.name);
  const need = usePetNeed();
  const moodAnim = needAnim(need);

  const [pos, setPos] = useState<Pt>(() => clampPos({ x: window.innerWidth - SIZE - 40, y: window.innerHeight - SIZE - 60 }));
  const [anim, setAnim] = useState<PetAnim>('idle');
  const [hover, setHover] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);

  const target = useRef<Pt | null>(null);
  const drag = useRef<{ dx: number; dy: number; lastX: number; moved: boolean } | null>(null);
  const special = useRef<number>(0);
  const posRef = useRef(pos);
  posRef.current = pos;
  const mouse = useRef<Pt | null>(null);
  const chaseStart = useRef(0);
  const onCaught = useRef<() => void>(() => {});
  const chasing = useRef(false);
  const lastChase = useRef(0);
  const tiredRef = useRef(false);
  tiredRef.current = need === 'tired' || need === 'sick';

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      mouse.current = null;
    };
    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (chasing.current && mouse.current && target.current) {
        target.current = clampPos({ x: mouse.current.x - SIZE / 2, y: mouse.current.y - SIZE * 0.35 });
      }
      const tgt = target.current;
      if (!drag.current && tgt && special.current < t) {
        const cur = posRef.current;
        const dx = tgt.x - cur.x;
        const dy = tgt.y - cur.y;
        const dist = Math.hypot(dx, dy);
        if (dist < (chasing.current ? 30 : 4)) {
          target.current = null;
          if (chasing.current) {
            chasing.current = false;
            lastChase.current = t;
            onCaught.current();
          } else {
            setAnim('idle');
          }
        } else if (chasing.current && t - chaseStart.current > 7000) {
          chasing.current = false;
          target.current = null;
          setAnim('idle');
        } else {
          const speed = tiredRef.current ? SPEED * 0.5 : chasing.current ? SPEED * 1.9 : SPEED;
          const k = Math.min(1, (speed * dt) / dist);
          setPos({ x: cur.x + dx * k, y: cur.y + dy * k });
          setAnim(dx >= 0 ? 'run-right' : 'run-left');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (drag.current || target.current || special.current > performance.now() || hover) return;
      const now = performance.now();
      const m = mouse.current;
      const canChase = m && !tiredRef.current && now - lastChase.current > 12000;
      if (canChase && Math.random() < 0.35) {
        const p = posRef.current;
        if (Math.hypot(m.x - (p.x + SIZE / 2), m.y - (p.y + SIZE / 2)) > SIZE) {
          chasing.current = true;
          chaseStart.current = now;
          target.current = clampPos({ x: m.x - SIZE / 2, y: m.y - SIZE * 0.35 });
          return;
        }
      }
      if (Math.random() < (tiredRef.current ? 0.2 : 0.6)) {
        target.current = randomPoint(posRef.current);
      }
    }, 3500);
    return () => clearInterval(id);
  }, [hover]);

  useEffect(() => {
    const onResize = () => {
      setPos((p) => clampPos(p));
      if (target.current) target.current = clampPos(target.current);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const playOnce = (a: PetAnim, ms: number, text?: string) => {
    target.current = null;
    chasing.current = false;
    special.current = performance.now() + ms;
    setAnim(a);
    if (text) setBubble(text);
    setTimeout(() => {
      setAnim('idle');
      setBubble(null);
    }, ms);
  };

  const CAUGHT_PHRASES = ['Поймал!', 'Попался!', 'Привет-привет!', 'Поиграем?', 'Я тут!'];
  onCaught.current = () => {
    const pick = CAUGHT_PHRASES[Math.floor(Math.random() * CAUGHT_PHRASES.length)];
    playOnce(Math.random() < 0.5 ? 'wave' : 'jump', 1400, pick);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    chasing.current = false;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, lastX: e.clientX, moved: false };
    target.current = null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const next = clampPos({ x: e.clientX - d.dx, y: e.clientY - d.dy });
    if (Math.hypot(next.x - pos.x, next.y - pos.y) > 2) d.moved = true;
    if (Math.abs(e.clientX - d.lastX) > 1) setAnim(e.clientX > d.lastX ? 'run-right' : 'run-left');
    d.lastX = e.clientX;
    setPos(next);
  };

  const clicks = useRef(0);
  const clickReset = useRef<ReturnType<typeof setTimeout>>();

  const onPointerUp = () => {
    const moved = drag.current?.moved;
    drag.current = null;
    if (moved) {
      playOnce('jump', 700);
    } else {
      clicks.current += 1;
      if (clicks.current === 1) {
        playOnce('wave', 1600, `Привет! Я ${name}`);
      } else {
        usePetStore.getState().pet();
        const lines = ['Мррр…', 'Ещё!', 'Приятно!', 'Хи-хи!'];
        playOnce('pet', 1400, lines[Math.floor(Math.random() * lines.length)]);
      }
      clearTimeout(clickReset.current);
      clickReset.current = setTimeout(() => (clicks.current = 0), 4000);
    }
  };

  const shownAnim: PetAnim = anim === 'idle' && moodAnim ? moodAnim : anim;
  const nearBottom = pos.y > window.innerHeight - SIZE - 110;

  return (
    <div
      className="fixed z-[60] select-none"
      style={{ left: pos.x, top: pos.y, width: SIZE }}
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
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-10 animate-fadeIn ${nearBottom ? '-top-11' : '-bottom-9'}`}
        >
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

      <div className="fixed bottom-4 right-4 z-[61] flex flex-col items-end gap-2">
        {!pipWin && !visible && (
          <button
            onClick={() => setVisible(true)}
            className="btn-neon !px-3.5 !py-2.5 !text-xs"
          >
            <Icon name="PawPrint" size={14} /> Выпустить питомца
          </button>
        )}
        {!pipWin && canPip && (
          <button
            onClick={openPip}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#12102b]/80 px-3.5 py-2.5 text-xs font-bold text-white/80 shadow-xl backdrop-blur-xl transition hover:bg-[#1c1940] hover:text-white"
          >
            <Icon name="PictureInPicture2" size={14} /> Поверх всех окон
          </button>
        )}
        {pipWin && (
          <button
            onClick={closePip}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#12102b]/80 px-3.5 py-2.5 text-xs font-bold text-white/80 shadow-xl backdrop-blur-xl transition hover:bg-[#1c1940] hover:text-white"
          >
            <Icon name="Undo2" size={14} /> Вернуть питомца на сайт
          </button>
        )}
      </div>
    </>
  );
}