import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { usePetStore } from '@/store/petStore';
import { track } from '@/store/achievementStore';
import Icon from '@/components/ui/icon';
import { PetSprite } from './PetSprite';
import type { PetAnim } from './sprites';
import { GameResult } from './ui';
import { sfx } from './sound';
import { canStartGame, rewardLabel } from './gameLogic';
import {
  COLS,
  ROWS,
  cellsOf,
  dropPosition,
  gravityTick,
  hardDrop,
  moveH,
  newGame,
  kindIndex,
  rewardFor,
  rotateCW,
  shapeOf,
  softDrop,
  speedMs,
  type Kind,
  type TetrisState,
} from './tetrisLogic';

type Phase = 'intro' | 'play' | 'paused' | 'over';

const WIN_LINES = 10;
const HOLD_DELAY = 260;
const HOLD_EVERY = 70;

const CELL_CLASS = [
  '',
  'bg-gradient-to-br from-cyan-300 to-cyan-500',
  'bg-gradient-to-br from-yellow-200 to-amber-400',
  'bg-gradient-to-br from-fuchsia-400 to-purple-600',
  'bg-gradient-to-br from-emerald-300 to-green-500',
  'bg-gradient-to-br from-rose-400 to-red-600',
  'bg-gradient-to-br from-sky-400 to-blue-600',
  'bg-gradient-to-br from-orange-300 to-orange-500',
];

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar']);

function Cell({ v, ghost = false }: { v: number; ghost?: boolean }) {
  if (!v) return <div className="rounded-[3px] bg-white/[0.03]" />;
  if (ghost) return <div className="rounded-[3px] border border-white/25 bg-white/[0.06]" />;
  return <div className={`rounded-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] ${CELL_CLASS[v]}`} />;
}

function NextPreview({ kind }: { kind: Kind }) {
  const shape = shapeOf(kind, 0);
  const size = shape.length;
  return (
    <div data-testid="tetris-next" className="grid aspect-square w-16 gap-[2px]" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
      {shape.flatMap((row, r) => row.map((v, c) => <Cell key={`${r}-${c}`} v={v ? kindIndex(kind) : 0} />))}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: string; label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5">
      <span className="flex items-center gap-1.5 text-xs font-bold text-white/55">
        <Icon name={icon} size={13} />
        {label}
      </span>
      <span data-testid={`tetris-${label}`} className={`text-sm font-extrabold tabular-nums ${tone}`}>
        {value}
      </span>
    </div>
  );
}

export function TetrisGame({ onComplete }: { onComplete: () => void }) {
  const type = usePetStore((s) => s.type);
  const playedGame = usePetStore((s) => s.playedGame);
  const energy = usePetStore((s) => s.energy);

  const [phase, setPhaseState] = useState<Phase>('intro');
  const [gained, setGained] = useState<number | null>(null);
  const [anim, setAnim] = useState<PetAnim>('idle');
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  const phaseRef = useRef<Phase>('intro');
  const engine = useRef<TetrisState>(newGame(Math.random));
  const rewarded = useRef(false);
  const alive = useRef(true);
  const animTimer = useRef<ReturnType<typeof setTimeout>>();
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const holdRepeat = useRef<ReturnType<typeof setInterval>>();

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const react = useCallback((a: PetAnim, ms = 900) => {
    setAnim(a);
    clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => {
      if (alive.current) setAnim('idle');
    }, ms);
  }, []);

  const stopHold = useCallback(() => {
    clearTimeout(holdTimer.current);
    clearInterval(holdRepeat.current);
    holdTimer.current = undefined;
    holdRepeat.current = undefined;
  }, []);

  const finish = useCallback(() => {
    if (rewarded.current) return;
    rewarded.current = true;
    stopHold();
    phaseRef.current = 'over';
    setPhaseState('over');
    const lines = engine.current.lines;
    if (lines > 0) sfx.win();
    else sfx.lose();
    clearTimeout(animTimer.current);
    setAnim('failed');
    setGained(playedGame('tetris', rewardFor(lines)));
    track.game('tetris');
    if (lines >= WIN_LINES) track.win();
  }, [playedGame, stopHold]);

  const apply = useCallback(
    (fn: (s: TetrisState) => TetrisState) => {
      if (phaseRef.current !== 'play' || !alive.current) return;
      const before = engine.current;
      const after = fn(before);
      if (after === before) return;
      engine.current = after;
      if (after.clearId !== before.clearId) {
        sfx.good();
        react(after.lastCleared >= 4 ? 'wave' : after.lastCleared >= 2 ? 'play' : 'jump');
      }
      if (after.over) finish();
      rerender();
    },
    [finish, react],
  );

  const start = () => {
    if (!canStartGame(usePetStore.getState().energy)) return;
    stopHold();
    clearTimeout(animTimer.current);
    engine.current = newGame(Math.random);
    rewarded.current = false;
    setGained(null);
    setAnim('idle');
    setPhase('play');
    sfx.pop();
    rerender();
  };

  const pause = useCallback(() => {
    if (phaseRef.current !== 'play') return;
    stopHold();
    phaseRef.current = 'paused';
    setPhaseState('paused');
  }, [stopHold]);

  const resume = () => {
    if (phaseRef.current !== 'paused') return;
    setPhase('play');
  };

  const level = engine.current.level;
  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => apply(gravityTick), speedMs(level));
    return () => clearInterval(id);
  }, [phase, level, apply]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(animTimer.current);
      clearTimeout(holdTimer.current);
      clearInterval(holdRepeat.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!GAME_KEYS.has(e.key)) return;
      const ph = phaseRef.current;
      if (ph !== 'play' && ph !== 'paused') return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (ph === 'paused') {
        if (target?.tagName !== 'BUTTON') e.preventDefault();
        return;
      }
      e.preventDefault();
      switch (e.key) {
        case 'ArrowLeft':
          return apply((s) => moveH(s, -1));
        case 'ArrowRight':
          return apply((s) => moveH(s, 1));
        case 'ArrowUp':
          return apply(rotateCW);
        case 'ArrowDown':
          return apply(softDrop);
        default:
          if (!e.repeat) apply(hardDrop);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Spacebar') && (phaseRef.current === 'play' || phaseRef.current === 'paused')) e.preventDefault();
    };
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [apply, pause]);

  const press = (fn: (s: TetrisState) => TetrisState, repeat: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    stopHold();
    apply(fn);
    if (!repeat) return;
    holdTimer.current = setTimeout(() => {
      holdRepeat.current = setInterval(() => apply(fn), HOLD_EVERY);
    }, HOLD_DELAY);
  };

  const s = engine.current;
  const view = s.board.map((row) => [...row]);
  const ghostSet = new Set<string>();
  if (phase === 'play' || phase === 'paused') {
    for (const { x, y } of cellsOf(dropPosition(s.board, s.piece))) ghostSet.add(`${x},${y}`);
    for (const { x, y } of cellsOf(s.piece)) {
      if (y >= 0 && y < ROWS) view[y][x] = kindIndex(s.piece.kind);
      ghostSet.delete(`${x},${y}`);
    }
  }

  if (phase === 'over') {
    return (
      <GameResult
        pet={<PetSprite type={type} anim={s.lines > 0 ? 'play' : 'failed'} size={110} />}
        title={s.lines > 0 ? `Очищено линий: ${s.lines}` : 'Стакан переполнен'}
        subtitle={`Очки: ${s.score} · уровень ${s.level}`}
        reward={rewardLabel(gained)}
        onAgain={canStartGame(energy) ? start : undefined}
        onExit={onComplete}
      />
    );
  }

  const holdBtn = 'btn-ghost !h-14 !w-14 !p-0 touch-manipulation select-none justify-center';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-white/55">Собирай линии — стрелки, ↑ поворот, пробел — сброс</span>
        <button
          onClick={phase === 'paused' ? resume : pause}
          disabled={phase === 'intro'}
          className="btn-ghost !px-3 !py-1.5 text-sm"
          aria-label={phase === 'paused' ? 'Продолжить' : 'Пауза'}
        >
          <Icon name={phase === 'paused' ? 'Play' : 'Pause'} size={14} />
          {phase === 'paused' ? 'Продолжить' : 'Пауза'}
        </button>
      </div>

      <div className="mx-auto flex max-w-md items-start justify-center gap-3">
        <div className="pa-field pa-field-grid relative w-[min(58vw,240px)] shrink-0 touch-none select-none p-1">
          <div
            data-testid="tetris-board"
            className="grid aspect-[1/2] gap-[2px]"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
          >
            {view.flatMap((row, y) =>
              row.map((v, x) => (ghostSet.has(`${x},${y}`) ? <Cell key={`${x}-${y}`} v={kindIndex(s.piece.kind)} ghost /> : <Cell key={`${x}-${y}`} v={v} />)),
            )}
          </div>

          {phase === 'intro' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07061a]/75 p-3 text-center backdrop-blur-sm">
              <p className="mb-2 font-display text-xl font-bold text-white">Готов строить?</p>
              <p className="mb-4 text-xs text-white/60">Заполняй горизонтальные линии. Каждая очищенная линия — +5 опыта, максимум 60.</p>
              <button onClick={start} className="btn-neon pa-shine">
                <Icon name="Play" size={16} />
                Старт
              </button>
            </div>
          )}

          {phase === 'paused' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07061a]/80 p-3 text-center backdrop-blur-sm">
              <p className="mb-3 font-display text-xl font-bold text-white">Пауза</p>
              <button onClick={resume} className="btn-neon">
                <Icon name="Play" size={16} />
                Продолжить
              </button>
            </div>
          )}
        </div>

        <div className="flex w-28 flex-col gap-2 sm:w-32">
          <Stat icon="Star" label="Очки" value={s.score} tone="text-amber-300" />
          <Stat icon="Rows3" label="Линии" value={s.lines} tone="text-emerald-300" />
          <Stat icon="Gauge" label="Уровень" value={s.level} tone="text-sky-300" />
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-2">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/45">Далее</div>
            <div className="flex justify-center">
              <NextPreview kind={s.next} />
            </div>
          </div>
          <div className="hidden justify-center sm:flex" data-testid="tetris-pet" data-anim={anim}>
            <PetSprite type={type} anim={anim} size={84} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 sm:hidden" data-testid="tetris-touch">
        <button className={holdBtn} aria-label="Влево" onPointerDown={press((st) => moveH(st, -1), true)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>
          <Icon name="ArrowLeft" size={22} />
        </button>
        <button className={holdBtn} aria-label="Повернуть" onPointerDown={press(rotateCW, false)}>
          <Icon name="RotateCw" size={22} />
        </button>
        <button className={holdBtn} aria-label="Вниз" onPointerDown={press(softDrop, true)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>
          <Icon name="ArrowDown" size={22} />
        </button>
        <button className={holdBtn} aria-label="Вправо" onPointerDown={press((st) => moveH(st, 1), true)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>
          <Icon name="ArrowRight" size={22} />
        </button>
        <button className={`${holdBtn} !border-pink-300/40`} aria-label="Сбросить" onPointerDown={press(hardDrop, false)}>
          <Icon name="ChevronsDown" size={22} />
        </button>
      </div>
    </div>
  );
}
