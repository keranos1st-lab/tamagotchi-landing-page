import { useState, useEffect, useRef } from 'react';
import { usePetStore } from '@/store/petStore';

type MiniGame = 'none' | 'catch' | 'memory' | 'quiz' | 'snake' | 'tictactoe' | 'reaction';

export function MiniGames() {
  const [activeGame, setActiveGame] = useState<MiniGame>('none');
  const { energy } = usePetStore();

  if (energy < 10) {
    return (
      <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/20">
        <h3 className="text-white font-bold mb-2">🎮 Мини-игры</h3>
        <p className="text-purple-300 text-sm">Мало энергии для игр. Уложите питомца спать!</p>
      </div>
    );
  }

  const games = [
    { id: 'catch' as MiniGame, icon: '🍖', name: 'Ловля еды', desc: 'Рефлексы', reward: '+15 IQ', color: 'from-orange-500 to-amber-500' },
    { id: 'memory' as MiniGame, icon: '🃏', name: 'Мемори', desc: 'Память', reward: '+20 IQ', color: 'from-blue-500 to-cyan-500' },
    { id: 'quiz' as MiniGame, icon: '🧠', name: 'Викторина', desc: 'Знания', reward: '+25 IQ', color: 'from-purple-500 to-pink-500' },
    { id: 'snake' as MiniGame, icon: '🐍', name: 'Змейка', desc: 'Классика', reward: '+30 IQ', color: 'from-green-500 to-emerald-500' },
    { id: 'tictactoe' as MiniGame, icon: '⭕', name: 'Крестики-нолики', desc: 'Стратегия', reward: '+20 IQ', color: 'from-red-500 to-rose-500' },
    { id: 'reaction' as MiniGame, icon: '⚡', name: 'Реакция', desc: 'Скорость', reward: '+15 IQ', color: 'from-yellow-500 to-orange-500' },
  ];

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/20">
      <h3 className="text-white font-bold mb-3">🎮 Мини-игры</h3>
      
      {activeGame === 'none' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => setActiveGame(game.id)}
              className="group relative p-4 bg-slate-700/50 rounded-xl border border-purple-500/20 hover:border-purple-400 transition-all hover:scale-105 overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
              <div className="text-3xl mb-2">{game.icon}</div>
              <div className="text-white text-sm font-bold">{game.name}</div>
              <div className="text-purple-300 text-xs mt-1">{game.desc}</div>
              <div className="text-green-400 text-xs mt-1 font-medium">{game.reward}</div>
            </button>
          ))}
        </div>
      )}

      {activeGame === 'catch' && <CatchGame onComplete={() => setActiveGame('none')} />}
      {activeGame === 'memory' && <MemoryGame onComplete={() => setActiveGame('none')} />}
      {activeGame === 'quiz' && <QuizGame onComplete={() => setActiveGame('none')} />}
      {activeGame === 'snake' && <SnakeGame onComplete={() => setActiveGame('none')} />}
      {activeGame === 'tictactoe' && <TicTacToeGame onComplete={() => setActiveGame('none')} />}
      {activeGame === 'reaction' && <ReactionGame onComplete={() => setActiveGame('none')} />}
    </div>
  );
}

// ========== ИГРА 1: ЛОВЛЯ ЕДЫ ==========
function CatchGame({ onComplete }: { onComplete: () => void }) {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [items, setItems] = useState<Array<{ id: number; x: number; y: number; type: 'good' | 'bad'; emoji: string }>>([]);
  const [gameOver, setGameOver] = useState(false);
  const { gainExp } = usePetStore();
  const nextId = useRef(0);

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
    } else {
      setScore(s => Math.max(0, s - 15));
    }
  };

  useEffect(() => {
    if (gameOver) {
      gainExp(Math.floor(score / 2));
    }
  }, [gameOver]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-purple-200 text-sm">Лови еду, избегай мусора!</span>
        <div className="flex gap-3">
          <span className="text-green-400 text-sm font-bold">Очки: {score}</span>
          <span className="text-yellow-400 text-sm font-bold">⏱️ {timeLeft}с</span>
        </div>
      </div>

      {!gameOver ? (
        <div className="relative h-64 bg-gradient-to-b from-sky-900/30 to-slate-900/50 rounded-xl border border-purple-500/20 overflow-hidden">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => catchItem(item.id, item.type)}
              className="absolute text-2xl transition-all hover:scale-125 cursor-pointer"
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
            >
              {item.emoji}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-white text-lg font-bold mb-2">Результат: {score} очков</p>
          <p className="text-purple-300 text-sm mb-4">+{Math.floor(score / 2)} опыта питомцу!</p>
          <button
            onClick={onComplete}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg hover:from-purple-500 hover:to-pink-500 transition"
          >
            Завершить
          </button>
        </div>
      )}
    </div>
  );
}

// ========== ИГРА 2: МЕМОРИ ==========
function MemoryGame({ onComplete }: { onComplete: () => void }) {
  const emojis = ['🐱', '🐕', '🐦', '🦊', '🐉', '🐰', '🐼', '🦉'];
  const [cards, setCards] = useState<Array<{ id: number; emoji: string; flipped: boolean; matched: boolean }>>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const { gainExp } = usePetStore();

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
      setMoves(m => m + 1);
      const [first, second] = newFlipped;
      
      if (cards[first].emoji === cards[second].emoji) {
        setTimeout(() => {
          const matched = [...cards];
          matched[first].matched = true;
          matched[second].matched = true;
          setCards(matched);
          setFlippedCards([]);
          
          if (matched.every(c => c.matched)) {
            setGameWon(true);
            gainExp(Math.max(10, 50 - moves * 2));
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
      <div className="flex justify-between items-center">
        <span className="text-purple-200 text-sm">Найди все пары!</span>
        <span className="text-purple-300 text-xs">Ходов: {moves}</span>
      </div>

      {!gameWon ? (
        <div className="grid grid-cols-4 gap-2">
          {cards.map((card, i) => (
            <button
              key={i}
              onClick={() => handleCardClick(i)}
              className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all ${
                card.flipped || card.matched
                  ? 'bg-purple-600 scale-105'
                  : 'bg-slate-700 hover:bg-slate-600 hover:scale-105'
              } ${card.matched ? 'opacity-50' : ''}`}
            >
              {card.flipped || card.matched ? card.emoji : '?'}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🎊</div>
          <p className="text-white text-lg font-bold mb-2">Победа за {moves} ходов!</p>
          <p className="text-purple-300 text-sm mb-4">+{Math.max(10, 50 - moves * 2)} опыта!</p>
          <button
            onClick={onComplete}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg hover:from-purple-500 hover:to-pink-500 transition"
          >
            Завершить
          </button>
        </div>
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
  const [showResult, setShowResult] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const { gainExp } = usePetStore();

  const handleAnswer = (index: number) => {
    if (selected !== null) return;
    setSelected(index);
    setShowResult(true);

    if (index === questions[currentQ].correct) {
      setScore(s => s + 1);
    }

    setTimeout(() => {
      if (currentQ + 1 >= questions.length) {
        setGameOver(true);
        gainExp(score * 5 + (index === questions[currentQ].correct ? 5 : 0));
      } else {
        setCurrentQ(q => q + 1);
        setSelected(null);
        setShowResult(false);
      }
    }, 1500);
  };

  return (
    <div className="space-y-4">
      {!gameOver ? (
        <>
          <div className="flex justify-between items-center">
            <span className="text-purple-200 text-sm">Вопрос {currentQ + 1}/{questions.length}</span>
            <span className="text-green-400 text-sm font-bold">Очки: {score}</span>
          </div>

          <div className="bg-slate-700/50 rounded-xl p-4 border border-purple-500/20">
            <p className="text-white text-lg font-medium mb-4">{questions[currentQ].q}</p>
            <div className="grid grid-cols-1 gap-2">
              {questions[currentQ].a.map((answer, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={selected !== null}
                  className={`p-3 rounded-lg text-left transition-all ${
                    selected === null
                      ? 'bg-slate-600 hover:bg-purple-600 text-white'
                      : i === questions[currentQ].correct
                      ? 'bg-green-600 text-white'
                      : selected === i
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-600 text-white opacity-50'
                  }`}
                >
                  {answer}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-white text-lg font-bold mb-2">Результат: {score}/{questions.length}</p>
          <p className="text-purple-300 text-sm mb-4">+{score * 5} опыта!</p>
          <button
            onClick={onComplete}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg hover:from-purple-500 hover:to-pink-500 transition"
          >
            Завершить
          </button>
        </div>
      )}
    </div>
  );
}

// ========== ИГРА 4: ЗМЕЙКА ==========
function SnakeGame({ onComplete }: { onComplete: () => void }) {
  const [snake, setSnake] = useState<Array<{ x: number; y: number }>>([{ x: 5, y: 5 }]);
  const [food, setFood] = useState({ x: 10, y: 10 });
  const [direction, setDirection] = useState<'UP' | 'DOWN' | 'LEFT' | 'RIGHT'>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const { gainExp } = usePetStore();
  const gameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      setSnake(prev => {
        const head = { ...prev[0] };
        
        switch (direction) {
          case 'UP': head.y -= 1; break;
          case 'DOWN': head.y += 1; break;
          case 'LEFT': head.x -= 1; break;
          case 'RIGHT': head.x += 1; break;
        }

        // Check wall collision
        if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20) {
          setGameOver(true);
          return prev;
        }

        // Check self collision
        if (prev.some(segment => segment.x === head.x && segment.y === head.y)) {
          setGameOver(true);
          return prev;
        }

        const newSnake = [head, ...prev];

        // Check food
        if (head.x === food.x && head.y === food.y) {
          setScore(s => s + 10);
          setFood({
            x: Math.floor(Math.random() * 20),
            y: Math.floor(Math.random() * 20),
          });
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [direction, food, gameOver]);

  useEffect(() => {
    if (gameOver) {
      gainExp(Math.floor(score / 2));
    }
  }, [gameOver]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': if (direction !== 'DOWN') setDirection('UP'); break;
        case 'ArrowDown': if (direction !== 'UP') setDirection('DOWN'); break;
        case 'ArrowLeft': if (direction !== 'RIGHT') setDirection('LEFT'); break;
        case 'ArrowRight': if (direction !== 'LEFT') setDirection('RIGHT'); break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [direction]);

  const handleTouch = (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    if (dir === 'UP' && direction !== 'DOWN') setDirection('UP');
    if (dir === 'DOWN' && direction !== 'UP') setDirection('DOWN');
    if (dir === 'LEFT' && direction !== 'RIGHT') setDirection('LEFT');
    if (dir === 'RIGHT' && direction !== 'LEFT') setDirection('RIGHT');
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-purple-200 text-sm">Управляй стрелками!</span>
        <span className="text-green-400 text-sm font-bold">Очки: {score}</span>
      </div>

      {!gameOver ? (
        <>
          <div
            ref={gameRef}
            className="relative w-full aspect-square bg-slate-900 rounded-xl border border-purple-500/20 overflow-hidden"
            style={{ maxWidth: '300px', margin: '0 auto' }}
          >
            {/* Grid */}
            <div className="absolute inset-0 grid grid-cols-20 grid-rows-20">
              {Array.from({ length: 400 }).map((_, i) => (
                <div key={i} className="border border-slate-800/30" />
              ))}
            </div>

            {/* Snake */}
            {snake.map((segment, i) => (
              <div
                key={i}
                className={`absolute w-[5%] h-[5%] rounded-sm ${i === 0 ? 'bg-green-400' : 'bg-green-500'}`}
                style={{ left: `${segment.x * 5}%`, top: `${segment.y * 5}%` }}
              />
            ))}

            {/* Food */}
            <div
              className="absolute w-[5%] h-[5%] bg-red-500 rounded-full"
              style={{ left: `${food.x * 5}%`, top: `${food.y * 5}%` }}
            />
          </div>

          {/* Mobile controls */}
          <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
            <div />
            <button onClick={() => handleTouch('UP')} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg">↑</button>
            <div />
            <button onClick={() => handleTouch('LEFT')} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg">←</button>
            <button onClick={() => handleTouch('DOWN')} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg">↓</button>
            <button onClick={() => handleTouch('RIGHT')} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg">→</button>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">💀</div>
          <p className="text-white text-lg font-bold mb-2">Длина змейки: {snake.length}</p>
          <p className="text-purple-300 text-sm mb-4">+{Math.floor(score / 2)} опыта!</p>
          <button
            onClick={onComplete}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg hover:from-purple-500 hover:to-pink-500 transition"
          >
            Завершить
          </button>
        </div>
      )}
    </div>
  );
}

// ========== ИГРА 5: КРЕСТИКИ-НОЛИКИ ==========
function TicTacToeGame({ onComplete }: { onComplete: () => void }) {
  const [board, setBoard] = useState<Array<'X' | 'O' | null>>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [winner, setWinner] = useState<'X' | 'O' | 'draw' | null>(null);
  const { gainExp } = usePetStore();

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

    const result = checkWinner(newBoard);
    if (result) {
      setWinner(result);
      if (result === 'X') gainExp(20);
      else if (result === 'draw') gainExp(10);
      return;
    }

    setIsPlayerTurn(false);
    setTimeout(() => {
      const aiIndex = aiMove(newBoard);
      const aiBoard = [...newBoard];
      aiBoard[aiIndex] = 'O';
      setBoard(aiBoard);

      const aiResult = checkWinner(aiBoard);
      if (aiResult) {
        setWinner(aiResult);
      }
      setIsPlayerTurn(true);
    }, 500);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-purple-200 text-sm">Вы: ✕ | Питомец: ○</span>
        <span className="text-purple-300 text-xs">
          {winner ? (winner === 'X' ? '🎉 Победа!' : winner === 'O' ? '😢 Поражение' : '🤝 Ничья') : isPlayerTurn ? 'Ваш ход' : 'Ход питомца...'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-[250px] mx-auto">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className="aspect-square bg-slate-700 hover:bg-slate-600 rounded-xl text-4xl font-bold transition-all disabled:cursor-not-allowed"
            disabled={!!cell || !!winner || !isPlayerTurn}
          >
            <span className={cell === 'X' ? 'text-blue-400' : 'text-pink-400'}>{cell}</span>
          </button>
        ))}
      </div>

      {winner && (
        <div className="text-center">
          <p className="text-purple-300 text-sm mb-3">
            {winner === 'X' ? '+20 опыта!' : winner === 'draw' ? '+10 опыта!' : 'Попробуй ещё раз!'}
          </p>
          <button
            onClick={onComplete}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg hover:from-purple-500 hover:to-pink-500 transition"
          >
            Завершить
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
  const { gainExp } = usePetStore();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const startRound = () => {
    setGameState('ready');
    const delay = Math.random() * 3000 + 2000; // 2-5 seconds
    timeoutRef.current = setTimeout(() => {
      setGameState('go');
      setStartTime(Date.now());
    }, delay);
  };

  const handleClick = () => {
    if (gameState === 'waiting' || gameState === 'done') {
      startRound();
      return;
    }

    if (gameState === 'ready') {
      // Too early!
      clearTimeout(timeoutRef.current);
      setGameState('waiting');
      return;
    }

    if (gameState === 'go') {
      const time = Date.now() - startTime;
      setReactionTime(time);
      setAttempts(a => a + 1);
      
      if (!bestTime || time < bestTime) {
        setBestTime(time);
      }

      setGameState('clicked');
      
      if (attempts + 1 >= 5) {
        setTimeout(() => {
          setGameState('done');
          gainExp(Math.max(10, Math.floor(1000 / (bestTime || time))));
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
      <div className="flex justify-between items-center">
        <span className="text-purple-200 text-sm">Нажми когда станет зелёным!</span>
        <span className="text-purple-300 text-xs">Попытка: {attempts + 1}/5</span>
      </div>

      {gameState === 'done' ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">⚡</div>
          <p className="text-white text-lg font-bold mb-2">Лучшее время: {bestTime}мс</p>
          <p className="text-purple-300 text-sm mb-4">+{Math.max(10, Math.floor(1000 / (bestTime || 1)))} опыта!</p>
          <button
            onClick={onComplete}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg hover:from-purple-500 hover:to-pink-500 transition"
          >
            Завершить
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={handleClick}
            className={`w-full h-48 rounded-xl text-white text-xl font-bold transition-all ${
              gameState === 'waiting'
                ? 'bg-blue-600 hover:bg-blue-500'
                : gameState === 'ready'
                ? 'bg-red-600'
                : gameState === 'go'
                ? 'bg-green-600 animate-pulse'
                : 'bg-slate-700'
            }`}
          >
            {gameState === 'waiting' && 'Нажми чтобы начать'}
            {gameState === 'ready' && 'Жди...'}
            {gameState === 'go' && 'ЖМИИИ!'}
            {gameState === 'clicked' && `${reactionTime}мс`}
          </button>
          {bestTime && (
            <p className="text-center text-purple-300 text-sm mt-2">Лучшее: {bestTime}мс</p>
          )}
        </>
      )}
    </div>
  );
}
