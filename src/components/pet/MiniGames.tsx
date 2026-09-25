import { useState, useEffect, useRef } from 'react';
import { usePetStore, type PetType } from '@/store/petStore';
import { PetSprite } from './PetSprite';
import { PET_ICONS, type PetAnim } from './sprites';
import { ChaseGame } from './ChaseGame';
import { track } from '@/store/achievementStore';

import Icon from '@/components/ui/icon';
import { GameResult } from './ui';
import { sfx } from './sound';
import { nextSnakeStep, placeFood, OPP, rewardLabel, type Cell, type Dir } from './gameLogic';


function MyPet({ anim, size = 96 }: { anim: PetAnim; size?: number }) {
  const type = usePetStore((s) => s.type);
  return <PetSprite type={type} anim={anim} size={size} />;
}

type MiniGame = 'none' | 'catch' | 'memory' | 'quiz' | 'snake' | 'tictactoe' | 'reaction' | 'chase';

const GAMES: { id: MiniGame; icon: string; name: string; desc: string; reward: string; grad: string; glow: string; tag?: string }[] = [
  { id: 'chase', icon: 'Footprints', name: 'Догонялки', desc: 'Убегай курсором от питомца', reward: 'до +60 XP', grad: 'from-pink-500 to-fuchsia-600', glow: 'rgba(236,72,153,0.55)', tag: 'Новое' },
  { id: 'catch', icon: 'Drumstick', name: 'Ловля еды', desc: 'Лови вкусное, мимо мусора', reward: 'до +50 XP', grad: 'from-orange-400 to-amber-500', glow: 'rgba(251,146,60,0.55)' },
  { id: 'memory', icon: 'Layers', name: 'Мемори', desc: 'Найди пары питомцев', reward: 'до +50 XP', grad: 'from-sky-400 to-blue-600', glow: 'rgba(56,189,248,0.55)' },
  { id: 'quiz', icon: 'Brain', name: 'Викторина', desc: 'Проверь знания', reward: 'до +40 XP', grad: 'from-violet-500 to-purple-700', glow: 'rgba(139,92,246,0.55)' },
  { id: 'snake', icon: 'Route', name: 'Змейка', desc: 'Питомец собирает хвост', reward: 'до +50 XP', grad: 'from-emerald-400 to-green-600', glow: 'rgba(52,211,153,0.55)' },
  { id: 'tictactoe', icon: 'Grid3x3', name: 'Крестики-нолики', desc: 'Обыграй питомца', reward: 'до +20 XP', grad: 'from-rose-500 to-red-600', glow: 'rgba(244,63,94,0.55)' },
  { id: 'reaction', icon: 'Zap', name: 'Реакция', desc: 'Кто быстрее?', reward: 'до +40 XP', grad: 'from-yellow-300 to-orange-500', glow: 'rgba(250,204,21,0.55)' },
];

export function MiniGames() {
  const [activeGame, setActiveGame] = useState<MiniGame>('none');
  const { energy } = usePetStore();
  const exit = () => setActiveGame('none');

  if (energy < 10) {
    return (
      <div className="glass flex items-center gap-4 p-5">
        <MyPet anim="sleep" size={90} />
        <div>
          <div className="font-display text-lg font-bold text-white">Нет сил играть</div>
          <p className="mt-1 text-sm text-white/55">Уложи питомца спать — и возвращайтесь к играм.</p>
        </div>
      </div>
    );
  }

  if (activeGame !== 'none') {
    const g = GAMES.find((x) => x.id === activeGame)!;
    return (
      <div className="glass p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <button onClick={exit} className="icon-btn !h-9 !w-9" title="Назад к играм">
            <Icon name="ArrowLeft" size={16} />
          </button>
          <div className={`pa-icon-chip h-9 w-9 bg-gradient-to-br ${g.grad} text-white`} style={{ ['--chip-glow' as string]: g.glow }}>
            <Icon name={g.icon} size={17} />
          </div>
          <div className="font-display text-base font-bold text-white">{g.name}</div>
        </div>
        {activeGame === 'catch' && <CatchGame onComplete={exit} />}
        {activeGame === 'memory' && <MemoryGame onComplete={exit} />}
        {activeGame === 'quiz' && <QuizGame onComplete={exit} />}
        {activeGame === 'snake' && <SnakeGame onComplete={exit} />}
        {activeGame === 'tictactoe' && <TicTacToeGame onComplete={exit} />}
        {activeGame === 'reaction' && <ReactionGame onComplete={exit} />}
        {activeGame === 'chase' && <ChaseGame onComplete={exit} />}
      </div>
    );
  }

  const [hero, ...rest] = GAMES;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setActiveGame(hero.id)}
        className="pa-tile group flex w-full items-center gap-4 overflow-hidden p-4 text-left sm:p-5"
      >
        <div className={`absolute inset-0 bg-gradient-to-r ${hero.grad} opacity-25 transition-opacity group-hover:opacity-40`} />
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-pink-400/30 blur-3xl" />
        <div className="relative shrink-0">
          <MyPet anim="run-right" size={96} />
        </div>
        <div className="relative flex-1">
          <span className="inline-block rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-pink-600">
            {hero.tag}
          </span>
          <div className="mt-1.5 font-display text-xl font-bold text-white">{hero.name}</div>
          <div className="text-sm text-white/70">{hero.desc}</div>
        </div>
        <div className="relative hidden sm:flex btn-neon !py-2.5">
          Играть
          <Icon name="Play" size={15} />
        </div>
      </button>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rest.map((g) => (
          <button key={g.id} onClick={() => setActiveGame(g.id)} className="pa-tile group p-4 text-left">
            <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${g.grad} opacity-20 blur-2xl transition-opacity group-hover:opacity-45`} />
            <div className={`pa-icon-chip relative h-11 w-11 bg-gradient-to-br ${g.grad} text-white`} style={{ ['--chip-glow' as string]: g.glow }}>
              <Icon name={g.icon} size={20} />
            </div>
            <div className="relative mt-3 font-extrabold text-white">{g.name}</div>
            <div className="relative mt-0.5 text-xs text-white/50">{g.desc}</div>
            <div className="relative mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
              <Icon name="Sparkles" size={11} />
              {g.reward}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ========== ИГРА 1: ЛОВЛЯ ЕДЫ ==========
function CatchGame({ onComplete }: { onComplete: () => void }) {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [items, setItems] = useState<Array<{ id: number; x: number; y: number; type: 'good' | 'bad'; emoji: string }>>([]);
  const [gameOver, setGameOver] = useState(false);
  const playedGame = usePetStore((s) => s.playedGame);
  const [gained, setGained] = useState<number | null>(null);
  const nextId = useRef(0);
  const [petAnim, setPetAnim] = useState<PetAnim>('idle');
  const animTimer = useRef<ReturnType<typeof setTimeout>>();
  const react = (a: PetAnim) => {
    setPetAnim(a);
    clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => setPetAnim('idle'), 900);
  };

  const goodItems = ['🍖', '🍎', '🐟', '🥕', '🍪', '🧀'];
  const badItems = ['💣', '🌶️', '🗑️', '☠️'];

  useEffect(() => {
    if (gameOver) return;

    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver]);

  useEffect(() => {
    if (gameOver) return;

    const spawner = setInterval(() => {
      const isGood = Math.random() > 0.3;
      const emojis = isGood ? goodItems : badItems;
      const newItem = {
        id: nextId.current++,
        x: Math.random() * 90 + 5,
        y: 0,
        type: isGood ? 'good' as const : 'bad' as const,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
      };
      setItems(prev => [...prev, newItem]);
    }, 800);

    return () => clearInterval(spawner);
  }, [gameOver]);

  useEffect(() => {
    if (gameOver) return;

    const mover = setInterval(() => {
      setItems(prev => {
        const updated = prev.map(item => ({ ...item, y: item.y + 3 }));
        return updated.filter(item => item.y < 100);
      });
    }, 100);

    return () => clearInterval(mover);
  }, [gameOver]);

  const catchItem = (id: number, type: 'good' | 'bad') => {
    setItems(prev => prev.filter(item => item.id !== id));
    if (type === 'good') {
      setScore(s => s + 10);
      react('eat');
      sfx.good();
    } else {
      setScore(s => Math.max(0, s - 15));
      react('failed');
      sfx.bad();
    }
  };

  useEffect(() => {
    if (gameOver) {
      sfx.win();
      setGained(playedGame('catch', Math.min(50, Math.floor(score / 3))));
      track.game('catch');
      track.best('catchBest', score);
      if (score >= 100) track.win();
    }
  }, [gameOver]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-white/55">Лови еду, избегай мусора!</span>
        <div className="flex gap-2"><div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-extrabold tabular-nums text-emerald-300"><Icon name="Star" size={14} />{score}</div><div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-extrabold tabular-nums text-amber-300"><Icon name="Timer" size={14} />{timeLeft}с</div></div>
      </div>

      {!gameOver ? (
        <div className="pa-field relative h-72">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => catchItem(item.id, item.type)}
              className="absolute text-3xl transition-transform hover:scale-125 cursor-pointer drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
            >
              {item.emoji}
            </button>
          ))}
          <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2">
            <MyPet anim={petAnim} size={90} />
          </div>
        </div>
      ) : (
        <GameResult
          pet={<MyPet anim="play" size={110} />}
          title={`${score} очков`}
          subtitle={score >= 150 ? 'Вот это реакция!' : 'Неплохо! Попробуй побить рекорд'}
          reward={rewardLabel(gained)}
          onExit={onComplete}
        />
      )}
    </div>
  );
}

// ========== ИГРА 2: МЕМОРИ ==========
function MemoryGame({ onComplete }: { onComplete: () => void }) {
  const emojis = Object.keys(PET_ICONS) as PetType[];
  const [cards, setCards] = useState<Array<{ id: number; emoji: string; flipped: boolean; matched: boolean }>>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const playedGame = usePetStore((s) => s.playedGame);
  const [gained, setGained] = useState<number | null>(null);
  const movesRef = useRef(0);

  useEffect(() => {
    const shuffled = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
    setCards(shuffled);
  }, []);

  const handleCardClick = (id: number) => {
    if (flippedCards.length === 2) return;
    if (cards[id].flipped || cards[id].matched) return;

    const newCards = [...cards];
    newCards[id].flipped = true;
    setCards(newCards);

    const newFlipped = [...flippedCards, id];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      movesRef.current += 1;
      setMoves(movesRef.current);
      const [first, second] = newFlipped;
      
      if (cards[first].emoji === cards[second].emoji) {
        setTimeout(() => {
          const matched = [...cards];
          matched[first].matched = true;
          matched[second].matched = true;
          sfx.good();
          setCards(matched);
          setFlippedCards([]);
          
          if (matched.every(c => c.matched)) {
            setGameWon(true);
            sfx.win();
            setGained(playedGame('memory', Math.max(10, 50 - Math.max(0, movesRef.current - 8) * 2)));
            track.game('memory');
            track.win();
          }
        }, 500);
      } else {
        setTimeout(() => {
          const reset = [...cards];
          reset[first].flipped = false;
          reset[second].flipped = false;
          setCards(reset);
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-white/55">Найди все пары!</span>
        <div className="flex gap-2"><div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-extrabold tabular-nums text-sky-300"><Icon name="MousePointerClick" size={14} />{moves}</div></div>
      </div>

      {!gameWon ? (
        <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-md mx-auto [perspective:800px]">
          {cards.map((card, i) => (
            <button
              key={i}
              onClick={() => handleCardClick(i)}
              className={`aspect-square rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                card.flipped || card.matched
                  ? 'bg-gradient-to-br from-sky-400/30 to-violet-500/30 border-sky-300/40 [transform:rotateY(0deg)]'
                  : 'bg-gradient-to-br from-white/[0.08] to-white/[0.02] border-white/10 hover:border-white/25 hover:-translate-y-0.5'
              } ${card.matched ? 'ring-2 ring-emerald-300/60 !bg-emerald-400/15' : ''}`}
            >
              {card.flipped || card.matched ? (
                <img src={PET_ICONS[card.emoji as PetType]} alt="" className="w-4/5 h-4/5 object-contain" draggable={false} />
              ) : (
                <Icon name="Sparkle" size={18} className="text-white/25" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <GameResult
          pet={<MyPet anim="play" size={110} />}
          title="Все пары найдены!"
          subtitle={`За ${moves} ходов`}
          reward={rewardLabel(gained)}
          onExit={onComplete}
        />
      )}
    </div>
  );
}

// ========== ИГРА 3: ВИКТОРИНА ==========
function QuizGame({ onComplete }: { onComplete: () => void }) {
  const questions = [
    { q: 'Сколько планет в Солнечной системе?', a: ['7', '8', '9', '10'], correct: 1 },
    { q: 'Какой язык программирования самый популярный?', a: ['Python', 'Java', 'C++', 'JavaScript'], correct: 3 },
    { q: 'Сколько байт в килобайте?', a: ['100', '1000', '1024', '2048'], correct: 2 },
    { q: 'Кто написал "Войну и мир"?', a: ['Достоевский', 'Толстой', 'Чехов', 'Пушкин'], correct: 1 },
    { q: 'Какая самая длинная река в мире?', a: ['Амазонка', 'Нил', 'Миссисипи', 'Янцзы'], correct: 1 },
    { q: 'Сколько костей в теле человека?', a: ['106', '206', '306', '406'], correct: 1 },
    { q: 'Какой элемент обозначается символом "O"?', a: ['Олово', 'Осмий', 'Кислород', 'Золото'], correct: 2 },
    { q: 'В каком году человек впервые полетел в космос?', a: ['1957', '1961', '1965', '1969'], correct: 1 },
  ];

  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const playedGame = usePetStore((s) => s.playedGame);
  const [gained, setGained] = useState<number | null>(null);
  const scoreRef = useRef(0);

  const handleAnswer = (index: number) => {
    if (selected !== null) return;
    setSelected(index);

    if (index === questions[currentQ].correct) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      sfx.good();
    } else {
      sfx.bad();
    }

    setTimeout(() => {
      if (currentQ + 1 >= questions.length) {
        setGameOver(true);
        {
          const final = scoreRef.current;
          setGained(playedGame('quiz', final * 5));
          track.game('quiz');
          if (final === questions.length) {
            track.bump('quizPerfect');
            track.win();
          }
        }
      } else {
        setCurrentQ(q => q + 1);
        setSelected(null);
      }
    }, 1500);
  };

  return (
    <div className="space-y-4">
      {!gameOver ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-pink-400 transition-all duration-500" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
            </div>
            <span className="text-xs font-bold text-white/50 tabular-nums">{currentQ + 1}/{questions.length}</span>
            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-extrabold text-emerald-300"><Icon name="Check" size={14} />{score}</div>
          </div>

          <div className="pa-field p-5 flex gap-4 items-start">
            <div className="hidden sm:block shrink-0 -mb-5 -ml-2 self-end"><MyPet anim={selected === null ? 'study' : selected === questions[currentQ].correct ? 'play' : 'failed'} size={100} /></div>
            <div className="flex-1">
            <p className="font-display text-lg font-bold text-white mb-4 leading-snug">{questions[currentQ].q}</p>
            <div className="grid grid-cols-1 gap-2">
              {questions[currentQ].a.map((answer, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={selected !== null}
                  className={`flex items-center gap-3 p-3 rounded-2xl text-left font-semibold border transition-all ${
                    selected === null
                      ? 'bg-white/[0.05] border-white/10 text-white hover:border-violet-300/50 hover:bg-violet-500/15'
                      : i === questions[currentQ].correct
                      ? 'bg-emerald-500/20 border-emerald-300/50 text-emerald-100'
                      : selected === i
                      ? 'bg-rose-500/20 border-rose-300/50 text-rose-100'
                      : 'bg-white/[0.03] border-white/5 text-white/40'
                  }`}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-extrabold">{'ABCD'[i]}</span>
                  {answer}
                </button>
              ))}
            </div>
            </div>
          </div>
        </>
      ) : (
        <GameResult
          pet={<MyPet anim="study" size={110} />}
          title={`${score} из ${questions.length}`}
          subtitle={score === questions.length ? 'Идеально! Настоящий гений' : 'Питомец стал немного умнее'}
          reward={rewardLabel(gained)}
          onExit={onComplete}
        />
      )}
    </div>
  );
}

// ========== ИГРА 4: ЗМЕЙКА ==========
function SnakeGame({ onComplete }: { onComplete: () => void }) {
  const [snake, setSnake] = useState<Cell[]>([{ x: 5, y: 5 }]);
  const [food, setFood] = useState<Cell>({ x: 10, y: 10 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const playedGame = usePetStore((s) => s.playedGame);
  const [gained, setGained] = useState<number | null>(null);
  const gameRef = useRef<HTMLDivElement>(null);
  const st = useRef({ snake: [{ x: 5, y: 5 }] as Cell[], food: { x: 10, y: 10 } as Cell, dir: 'RIGHT' as Dir, queue: [] as Dir[], score: 0, over: false });

  const turn = (d: Dir) => {
    const g = st.current;
    const last = g.queue.length ? g.queue[g.queue.length - 1] : g.dir;
    if (d === last || d === OPP[last] || g.queue.length >= 2) return;
    g.queue.push(d);
  };

  useEffect(() => {
    const id = setInterval(() => {
      const g = st.current;
      if (g.over) return;
      if (g.queue.length) g.dir = g.queue.shift()!;
      const r = nextSnakeStep(g.snake, g.dir, g.food);
      if (r.dead) {
        g.over = true;
        sfx.lose();
        setGameOver(true);
        return;
      }
      g.snake = r.snake;
      if (r.ate) {
        g.score += 10;
        sfx.eat();
        const f = placeFood(g.snake);
        if (!f) {
          g.over = true;
          setGameOver(true);
        } else g.food = f;
        setScore(g.score);
        setFood(g.food);
      }
      setSnake(g.snake);
    }, 150);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (gameOver) {
      const apples = st.current.score / 10;
      setGained(playedGame('snake', Math.min(50, apples * 4)));
      track.game('snake');
      track.best('snakeBest', apples);
      if (apples >= 10) track.win();
    }
  }, [gameOver, playedGame]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' };
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        turn(d);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleTouch = (dir: Dir) => turn(dir);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-white/55">Управляй стрелками на клавиатуре</span>
        <div className="flex gap-2"><div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-extrabold tabular-nums text-emerald-300"><Icon name="Apple" size={14} />{score}</div></div>
      </div>

      {!gameOver ? (
        <>
          <div
            ref={gameRef}
            className="pa-field pa-field-grid relative w-full aspect-square"
            style={{ maxWidth: '340px', margin: '0 auto' }}
          >
            {/* Grid */}


            {/* Snake */}
            {snake.map((segment, i) =>
              i === 0 ? (
                <div
                  key={i}
                  className="absolute w-[9%] h-[9%] z-10"
                  style={{ left: `${segment.x * 5 - 2}%`, top: `${segment.y * 5 - 2}%` }}
                >
                  <TttPet />
                </div>
              ) : (
                <div
                  key={i}
                  className="absolute w-[5%] h-[5%] rounded-full bg-gradient-to-br from-violet-300 to-pink-400 scale-75 shadow-[0_0_8px_rgba(236,72,153,0.7)]"
                  style={{ left: `${segment.x * 5}%`, top: `${segment.y * 5}%` }}
                />
              ),
            )}

            {/* Food */}
            <div
              className="absolute w-[5%] h-[5%] grid place-items-center text-[14px] leading-none animate-bounce-gentle"
              style={{ left: `${food.x * 5}%`, top: `${food.y * 5}%` }}
            >
              🍎
            </div>
          </div>

          {/* Mobile controls */}
          <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
            <div />
            <button onClick={() => handleTouch('UP')} className="icon-btn !w-full !h-12"><Icon name="ChevronUp" size={22} /></button>
            <div />
            <button onClick={() => handleTouch('LEFT')} className="icon-btn !w-full !h-12"><Icon name="ChevronLeft" size={22} /></button>
            <button onClick={() => handleTouch('DOWN')} className="icon-btn !w-full !h-12"><Icon name="ChevronDown" size={22} /></button>
            <button onClick={() => handleTouch('RIGHT')} className="icon-btn !w-full !h-12"><Icon name="ChevronRight" size={22} /></button>
          </div>
        </>
      ) : (
        <GameResult
          pet={<MyPet anim="failed" size={110} />}
          title={`Длина хвоста: ${snake.length}`}
          subtitle="Питомец врезался — но было весело!"
          reward={rewardLabel(gained)}
          onExit={onComplete}
        />
      )}
    </div>
  );
}

// ========== ИГРА 5: КРЕСТИКИ-НОЛИКИ ==========
function TicTacToeGame({ onComplete }: { onComplete: () => void }) {
  const [board, setBoard] = useState<Array<'X' | 'O' | null>>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [winner, setWinner] = useState<'X' | 'O' | 'draw' | null>(null);
  const playedGame = usePetStore((s) => s.playedGame);
  const [gained, setGained] = useState<number | null>(null);

  const checkWinner = (board: Array<'X' | 'O' | null>): 'X' | 'O' | 'draw' | null => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];

    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }

    if (board.every(cell => cell !== null)) {
      return 'draw';
    }

    return null;
  };

  const aiMove = (board: Array<'X' | 'O' | null>) => {
    // Simple AI: try to win, then block, then center, then random
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];

    // Try to win
    for (const [a, b, c] of lines) {
      const cells = [board[a], board[b], board[c]];
      if (cells.filter(c => c === 'O').length === 2 && cells.includes(null)) {
        return [a, b, c][cells.indexOf(null)];
      }
    }

    // Block player
    for (const [a, b, c] of lines) {
      const cells = [board[a], board[b], board[c]];
      if (cells.filter(c => c === 'X').length === 2 && cells.includes(null)) {
        return [a, b, c][cells.indexOf(null)];
      }
    }

    // Center
    if (board[4] === null) return 4;

    // Random
    const empty = board.map((cell, i) => cell === null ? i : -1).filter(i => i !== -1);
    return empty[Math.floor(Math.random() * empty.length)];
  };

  const handleClick = (index: number) => {
    if (board[index] || winner || !isPlayerTurn) return;

    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);
    sfx.pop();

    const result = checkWinner(newBoard);
    if (result) {
      setWinner(result);
      if (result === 'X') sfx.win();
      setGained(playedGame('tictactoe', result === 'X' ? 20 : result === 'draw' ? 10 : 0));
      track.game('tictactoe');
      if (result === 'X') {
        track.win();
        track.bump('tttWins');
      }
      return;
    }

    setIsPlayerTurn(false);
    setTimeout(() => {
      const aiIndex = aiMove(newBoard);
      const aiBoard = [...newBoard];
      aiBoard[aiIndex] = 'O';
      setBoard(aiBoard);

      const aiResult = checkWinner(aiBoard);
      sfx.click();
      if (aiResult) {
        setWinner(aiResult);
        if (aiResult === 'O') sfx.lose();
        setGained(playedGame('tictactoe', aiResult === 'draw' ? 10 : 2));
        track.game('tictactoe');
      }
      setIsPlayerTurn(true);
    }, 500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 transition ${isPlayerTurn && !winner ? 'border-sky-300/50 bg-sky-400/15' : 'border-white/10 bg-white/[0.04]'}`}>
          <Icon name="X" size={16} className="text-sky-300" strokeWidth={3} />
          <span className="text-sm font-bold text-white">Вы</span>
        </div>
        <span className="font-display text-sm font-bold text-white/70">
          {winner ? (winner === 'X' ? 'Победа!' : winner === 'O' ? 'Поражение' : 'Ничья') : 'VS'}
        </span>
        <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 transition ${!isPlayerTurn && !winner ? 'border-pink-300/50 bg-pink-400/15' : 'border-white/10 bg-white/[0.04]'}`}>
          <span className="h-5 w-5"><TttPet /></span>
          <span className="text-sm font-bold text-white">Питомец</span>
        </div>
      </div>

      <div className="flex justify-center">
        <MyPet
          size={90}
          anim={winner === 'O' ? 'play' : winner === 'X' ? 'failed' : winner === 'draw' ? 'wave' : isPlayerTurn ? 'idle' : 'study'}
        />
      </div>

      <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className="aspect-square grid place-items-center rounded-2xl border border-white/10 bg-white/[0.05] hover:enabled:bg-white/10 hover:enabled:border-white/25 transition-all disabled:cursor-not-allowed"
            disabled={!!cell || !!winner || !isPlayerTurn}
          >
            {cell === 'O' ? (
              <TttPet />
            ) : (
              cell && <Icon name="X" size={40} strokeWidth={3} className="text-sky-300 drop-shadow-[0_0_10px_rgba(56,189,248,0.7)] pa-pop" />
            )}
          </button>
        ))}
      </div>

      {winner && (
        <div className="text-center">
          <p className="text-emerald-300 text-sm font-bold mb-3">
            {winner === 'O' ? 'Питомец победил — реванш? ' : ''}
            {rewardLabel(gained)}
          </p>
          <button onClick={onComplete} className="btn-neon">
            Готово
          </button>
        </div>
      )}
    </div>
  );
}

// ========== ИГРА 6: РЕАКЦИЯ ==========
function ReactionGame({ onComplete }: { onComplete: () => void }) {
  const [gameState, setGameState] = useState<'waiting' | 'ready' | 'go' | 'clicked' | 'done'>('waiting');
  const [startTime, setStartTime] = useState(0);
  const [reactionTime, setReactionTime] = useState(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const playedGame = usePetStore((s) => s.playedGame);
  const [gained, setGained] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const startRound = () => {
    setGameState('ready');
    const delay = Math.random() * 3000 + 2000; // 2-5 seconds
    timeoutRef.current = setTimeout(() => {
      setGameState('go');
      sfx.pop();
      setStartTime(Date.now());
    }, delay);
  };

  const handleClick = () => {
    if (gameState === 'waiting' || gameState === 'done') {
      startRound();
      return;
    }

    if (gameState === 'ready') {
      sfx.bad();
      // Too early!
      clearTimeout(timeoutRef.current);
      setGameState('waiting');
      return;
    }

    if (gameState === 'go') {
      const time = Date.now() - startTime;
      setReactionTime(time);
      setAttempts(a => a + 1);
      
      const best = bestTime === null ? time : Math.min(bestTime, time);
      setBestTime(best);

      setGameState('clicked');
      sfx.good();
      
      if (attempts + 1 >= 5) {
        setTimeout(() => {
          setGameState('done');
          setGained(playedGame('reaction', Math.min(40, Math.max(10, Math.round((700 - best) / 12)))));
          track.game('reaction');
          track.best('reactionBest', best, true);
          track.win();
        }, 1500);
      } else {
        setTimeout(() => {
          startRound();
        }, 1500);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-white/55">Жми, когда станет зелёным!</span>
        <div className="flex gap-2"><div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-extrabold tabular-nums text-amber-300"><Icon name="Target" size={14} />{Math.min(attempts + 1, 5)}/5</div></div>
      </div>

      {gameState === 'done' ? (
        <GameResult
          pet={<MyPet anim="wave" size={110} />}
          title={`${bestTime} мс`}
          subtitle={bestTime && bestTime < 300 ? 'Молниеносно!' : 'Лучшее время реакции'}
          reward={rewardLabel(gained)}
          onExit={onComplete}
        />
      ) : (
        <>
          <button
            onClick={handleClick}
            className={`relative w-full h-56 rounded-3xl border font-display text-2xl font-bold text-white transition-all duration-200 overflow-hidden ${
              gameState === 'waiting'
                ? 'bg-gradient-to-br from-violet-600/70 to-indigo-700/70 border-violet-300/30 hover:brightness-110'
                : gameState === 'ready'
                ? 'bg-gradient-to-br from-rose-600/80 to-red-700/80 border-rose-300/40'
                : gameState === 'go'
                ? 'bg-gradient-to-br from-emerald-400 to-green-600 border-emerald-200/60 shadow-[0_0_60px_rgba(52,211,153,0.6)] scale-[1.01]'
                : 'bg-white/[0.06] border-white/10'
            }`}
          >
            {gameState === 'waiting' && 'Нажми чтобы начать'}
            {gameState === 'ready' && 'Жди...'}
            {gameState === 'go' && 'ЖМИИИ!'}
            {gameState === 'clicked' && `${reactionTime}мс`}
          </button>
          {bestTime && (
            <p className="text-center text-white/50 text-sm mt-3">Лучшее: <span className="font-bold text-amber-300">{bestTime} мс</span></p>
          )}
        </>
      )}
    </div>
  );
}

function TttPet() {
  const type = usePetStore((s) => s.type);
  return <img src={PET_ICONS[type]} alt="" className="w-4/5 h-4/5 object-contain mx-auto" draggable={false} />;
}
