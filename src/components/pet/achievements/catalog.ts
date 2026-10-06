import type { PetState } from '@/store/petStore';
import { streak, type Counter } from '@/store/achievementStore';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Category = 'care' | 'growth' | 'games' | 'bond' | 'secret';

export interface Ctx {
  pet: PetState;
  c: Partial<Record<Counter, number>>;
  gamesPlayed: string[];
  petsOwned: string[];
  days: string[];
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  rarity: Rarity;
  category: Category;
  xp: number;
  goal: number;
  value: (x: Ctx) => number;
  hidden?: boolean;
}

const n = (x: Ctx, k: Counter) => x.c[k] ?? 0;

export const RARITY: Record<Rarity, { label: string; ring: string; glow: string; text: string; grad: string; chip: string }> = {
  common: {
    label: 'Обычная',
    ring: 'border-slate-300/25',
    glow: 'rgba(203,213,225,0.35)',
    text: 'text-slate-200',
    grad: 'from-slate-300 to-slate-500',
    chip: 'bg-slate-400/15 text-slate-200 border-slate-300/20',
  },
  rare: {
    label: 'Редкая',
    ring: 'border-sky-300/35',
    glow: 'rgba(56,189,248,0.55)',
    text: 'text-sky-200',
    grad: 'from-sky-300 to-blue-600',
    chip: 'bg-sky-400/15 text-sky-200 border-sky-300/25',
  },
  epic: {
    label: 'Эпическая',
    ring: 'border-fuchsia-300/40',
    glow: 'rgba(217,70,239,0.6)',
    text: 'text-fuchsia-200',
    grad: 'from-fuchsia-400 to-violet-600',
    chip: 'bg-fuchsia-400/15 text-fuchsia-200 border-fuchsia-300/25',
  },
  legendary: {
    label: 'Легендарная',
    ring: 'border-amber-300/50',
    glow: 'rgba(251,191,36,0.7)',
    text: 'text-amber-200',
    grad: 'from-amber-300 via-orange-400 to-rose-500',
    chip: 'bg-amber-400/15 text-amber-200 border-amber-300/30',
  },
};

export const CATEGORIES: { id: Category | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'Все', icon: 'LayoutGrid' },
  { id: 'care', label: 'Забота', icon: 'Heart' },
  { id: 'growth', label: 'Рост', icon: 'TrendingUp' },
  { id: 'games', label: 'Игры', icon: 'Gamepad2' },
  { id: 'bond', label: 'Дружба', icon: 'Sparkles' },
  { id: 'secret', label: 'Секреты', icon: 'EyeOff' },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_meal', title: 'Первый обед', desc: 'Покорми питомца', icon: 'Drumstick', rarity: 'common', category: 'care', xp: 10, goal: 1, value: (x) => n(x, 'feed') },
  { id: 'chef', title: 'Шеф-повар', desc: 'Покорми питомца 25 раз', icon: 'ChefHat', rarity: 'rare', category: 'care', xp: 40, goal: 25, value: (x) => n(x, 'feed') },
  { id: 'gourmet', title: 'Гурман', desc: 'Покорми питомца 100 раз', icon: 'UtensilsCrossed', rarity: 'epic', category: 'care', xp: 120, goal: 100, value: (x) => n(x, 'feed') },
  { id: 'lullaby', title: 'Колыбельная', desc: 'Уложи питомца спать 10 раз', icon: 'Moon', rarity: 'common', category: 'care', xp: 20, goal: 10, value: (x) => n(x, 'sleep') },
  { id: 'doctor', title: 'Доктор Айболит', desc: 'Вылечи питомца 15 раз', icon: 'Stethoscope', rarity: 'rare', category: 'care', xp: 40, goal: 15, value: (x) => n(x, 'heal') },
  { id: 'perfect_day', title: 'Идеальный день', desc: 'Все показатели выше 90 одновременно', icon: 'Sun', rarity: 'epic', category: 'care', xp: 100, goal: 1, value: (x) => (x.pet.hunger > 90 && x.pet.happiness > 90 && x.pet.energy > 90 && x.pet.health > 90 ? 1 : 0) },
  { id: 'best_friend', title: 'Лучший друг', desc: 'Все показатели выше 70', icon: 'HeartHandshake', rarity: 'common', category: 'care', xp: 20, goal: 1, value: (x) => (x.pet.hunger > 70 && x.pet.happiness > 70 && x.pet.energy > 70 && x.pet.health > 70 ? 1 : 0) },

  { id: 'lvl5', title: 'Подросток', desc: 'Достигни 5 уровня — первая эволюция', icon: 'Sprout', rarity: 'rare', category: 'growth', xp: 50, goal: 5, value: (x) => x.pet.level },
  { id: 'lvl10', title: 'Взрослый', desc: 'Достигни 10 уровня — финальная эволюция', icon: 'TreePine', rarity: 'epic', category: 'growth', xp: 150, goal: 10, value: (x) => x.pet.level },
  { id: 'lvl20', title: 'Мастер', desc: 'Достигни 20 уровня', icon: 'Crown', rarity: 'legendary', category: 'growth', xp: 400, goal: 20, value: (x) => x.pet.level },
  { id: 'student', title: 'Ученик', desc: 'Позанимайся с питомцем 10 раз', icon: 'BookOpen', rarity: 'common', category: 'growth', xp: 20, goal: 10, value: (x) => n(x, 'train') },
  { id: 'smart', title: 'Умник', desc: 'Подними IQ до 50', icon: 'Brain', rarity: 'rare', category: 'growth', xp: 50, goal: 50, value: (x) => Math.round(x.pet.intelligence) },
  { id: 'genius', title: 'Гений', desc: 'Подними IQ до 100', icon: 'Lightbulb', rarity: 'legendary', category: 'growth', xp: 300, goal: 100, value: (x) => Math.round(x.pet.intelligence) },
  { id: 'old_timer', title: 'Старожил', desc: 'Проживи вместе 3 часа', icon: 'Hourglass', rarity: 'rare', category: 'growth', xp: 60, goal: 180, value: (x) => x.pet.age },

  { id: 'gamer', title: 'Игрок', desc: 'Сыграй 10 партий в мини-игры', icon: 'Gamepad2', rarity: 'common', category: 'games', xp: 20, goal: 10, value: (x) => n(x, 'games') },
  { id: 'all_games', title: 'Всё перепробовал', desc: 'Сыграй в каждую из 7 мини-игр', icon: 'Shapes', rarity: 'rare', category: 'games', xp: 60, goal: 7, value: (x) => x.gamesPlayed.length },
  { id: 'champion', title: 'Чемпион', desc: 'Одержи 25 побед в играх', icon: 'Trophy', rarity: 'epic', category: 'games', xp: 120, goal: 25, value: (x) => n(x, 'gameWins') },
  { id: 'quiz_ace', title: 'Отличник', desc: 'Ответь на все вопросы викторины', icon: 'GraduationCap', rarity: 'rare', category: 'games', xp: 50, goal: 1, value: (x) => n(x, 'quizPerfect') },
  { id: 'ttt_master', title: 'Стратег', desc: 'Обыграй питомца в крестики-нолики 5 раз', icon: 'Grid3x3', rarity: 'rare', category: 'games', xp: 50, goal: 5, value: (x) => n(x, 'tttWins') },
  { id: 'catcher', title: 'Мастер линий', desc: 'Очисти 10 линий за одну партию в «Тетрисе»', icon: 'Blocks', rarity: 'epic', category: 'games', xp: 100, goal: 10, value: (x) => n(x, 'tetrisLinesBest') },
  { id: 'snake_long', title: 'Длинный хвост', desc: 'Собери 15 яблок в «Змейке»', icon: 'Route', rarity: 'epic', category: 'games', xp: 100, goal: 15, value: (x) => n(x, 'snakeBest') },
  { id: 'lightning', title: 'Молния', desc: 'Среагируй быстрее 250 мс', icon: 'Zap', rarity: 'legendary', category: 'games', xp: 200, goal: 1, value: (x) => ((x.c.reactionBest ?? 9999) < 250 ? 1 : 0) },

  { id: 'first_pet', title: 'Первое касание', desc: 'Погладь питомца', icon: 'Hand', rarity: 'common', category: 'bond', xp: 10, goal: 1, value: (x) => n(x, 'pets') },
  { id: 'cuddler', title: 'Обнимашки', desc: 'Погладь питомца 200 раз', icon: 'HeartPulse', rarity: 'rare', category: 'bond', xp: 50, goal: 200, value: (x) => n(x, 'pets') },
  { id: 'chatter', title: 'Собеседник', desc: 'Отправь 20 сообщений в AI-чат', icon: 'MessagesSquare', rarity: 'common', category: 'bond', xp: 20, goal: 20, value: (x) => n(x, 'chat') },
  { id: 'philosopher', title: 'Философ', desc: 'Отправь 100 сообщений в AI-чат', icon: 'Quote', rarity: 'epic', category: 'bond', xp: 100, goal: 100, value: (x) => n(x, 'chat') },
  { id: 'showman', title: 'Шоумен', desc: 'Покажи фирменный трюк 10 раз', icon: 'Wand2', rarity: 'rare', category: 'bond', xp: 40, goal: 10, value: (x) => n(x, 'tricks') },
  { id: 'streak3', title: 'Верный друг', desc: 'Заходи к питомцу 3 дня подряд', icon: 'Flame', rarity: 'rare', category: 'bond', xp: 60, goal: 3, value: (x) => streak(x.days) },
  { id: 'streak7', title: 'Неразлучные', desc: 'Заходи к питомцу 7 дней подряд', icon: 'CalendarHeart', rarity: 'legendary', category: 'bond', xp: 250, goal: 7, value: (x) => streak(x.days) },

  { id: 'night_owl', title: 'Полуночник', desc: 'Загляни к питомцу между 0:00 и 5:00', icon: 'MoonStar', rarity: 'rare', category: 'secret', xp: 50, goal: 1, value: (x) => n(x, 'nightVisits'), hidden: true },
  { id: 'early_bird', title: 'Жаворонок', desc: 'Загляни к питомцу между 5:00 и 8:00', icon: 'Sunrise', rarity: 'rare', category: 'secret', xp: 50, goal: 1, value: (x) => n(x, 'morningVisits'), hidden: true },
  { id: 'collector', title: 'Коллекционер', desc: 'Заведи трёх разных питомцев', icon: 'Users', rarity: 'epic', category: 'secret', xp: 120, goal: 3, value: (x) => x.petsOwned.length, hidden: true },
  { id: 'overpet', title: 'Зацелованный', desc: 'Погладь питомца 1000 раз', icon: 'Sparkle', rarity: 'legendary', category: 'secret', xp: 300, goal: 1000, value: (x) => n(x, 'pets'), hidden: true },
];

export const progressOf = (a: Achievement, x: Ctx) => Math.min(1, a.value(x) / a.goal);
export const TOTAL_XP = ACHIEVEMENTS.reduce((s, a) => s + a.xp, 0);
