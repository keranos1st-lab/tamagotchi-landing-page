import type { PetType } from '@/store/petStore';

export interface Signature {
  label: string;
  icon: string;
  bubble: string[];
  duration: number;
  hint: string;
}

export const SIGNATURES: Record<PetType, Signature> = {
  cat: { label: 'Кодить', icon: 'Code', bubble: ['Пишу код!', 'Деплою!', 'Баг найден!'], duration: 2600, hint: 'Кодик садится писать код' },
  dog: { label: 'Апорт!', icon: 'CircleDot', bubble: ['Апорт!', 'Я принёс мячик!', 'Ещё кинешь?'], duration: 2600, hint: 'Собачка приносит мячик' },
  fox: { label: 'Фыр-фыр', icon: 'Wind', bubble: ['Фыр-фыр!', 'Где мой хвост?!', 'Поймаю!'], duration: 2400, hint: 'Лисёнок фыркает и ловит свой хвост' },
  dragon: { label: 'Огонь!', icon: 'Flame', bubble: ['Р-р-р!', 'Огонёк!', 'Пш-ш-ш!'], duration: 2400, hint: 'Дракончик взмахивает крыльями и дышит огнём' },
  bunny: { label: 'Прыг-скок', icon: 'Rabbit', bubble: ['Прыг-скок!', 'Вжух!', 'Выше всех!'], duration: 2200, hint: 'Зайчик делает прыжок с пируэтом' },
  panda: { label: 'Бамбук', icon: 'Leaf', bubble: ['Ням-ням…', 'Хрум-хрум', 'Вкусный бамбук'], duration: 3000, hint: 'Панда уютно грызёт бамбук' },
  owl: { label: 'Ух-ух', icon: 'RotateCcw', bubble: ['Ух-ух!', 'Всё вижу!', 'Кто там?'], duration: 2600, hint: 'Сова поворачивает голову назад' },
  bird: { label: 'Трель', icon: 'Music', bubble: ['Фьюить!', 'Ля-ля-ля!', 'Чик-чирик!'], duration: 2600, hint: 'Птичка поёт трели' },
};

export const pickBubble = (type: PetType) => {
  const b = SIGNATURES[type].bubble;
  return b[Math.floor(Math.random() * b.length)];
};
