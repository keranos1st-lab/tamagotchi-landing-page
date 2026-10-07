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
  dog: { label: 'Встряхнись!', icon: 'Sparkles', bubble: ['Мм-мм, пушистая!', 'Встряхнулась!', 'Сияю!'], duration: 2600, hint: 'Альпака встряхивает шёрстку и сияет' },
  fox: { label: 'Фыр-фыр', icon: 'Wind', bubble: ['Фыр-фыр!', 'Где мой хвост?!', 'Поймаю!'], duration: 2400, hint: 'Лисёнок фыркает, бегает кругами за хвостом и у него кружится голова' },
  dragon: { label: 'Огонь!', icon: 'Flame', bubble: ['Р-р-р!', 'Огонёк!', 'Пш-ш-ш!'], duration: 2400, hint: 'Дракончик набирает воздух и выпускает струю огня' },
  bunny: { label: 'Прыг-скок', icon: 'Rabbit', bubble: ['Прыг-скок!', 'Вжух!', 'Выше всех!'], duration: 2200, hint: 'Зайчик делает три высоких прыжка подряд' },
  panda: { label: 'Бамбук', icon: 'Leaf', bubble: ['Ням-ням…', 'Хрум-хрум', 'Вкусный бамбук'], duration: 3000, hint: 'Панда уютно грызёт бамбук' },
  owl: { label: 'Ух-ух', icon: 'RotateCcw', bubble: ['Ух-ух!', 'Всё вижу!', 'Кто там?'], duration: 2600, hint: 'Сова оглядывается по сторонам и придумывает идею' },
  bird: { label: 'Трель', icon: 'Music', bubble: ['Фьюить!', 'Ля-ля-ля!', 'Чик-чирик!'], duration: 2600, hint: 'Птичка поёт трели' },
};

export const pickBubble = (type: PetType) => {
  const b = SIGNATURES[type].bubble;
  return b[Math.floor(Math.random() * b.length)];
};
