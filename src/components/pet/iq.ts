export type IqLevel = 'baby' | 'smart' | 'genius';

export const IQ_SMART = 35;
export const IQ_GENIUS = 70;

export const IQ_LEVELS: Record<IqLevel, { name: string; from: number; to: number; textLimit: number; can: string[] }> = {
  baby: {
    name: 'Малыш',
    from: 0,
    to: IQ_SMART - 1,
    textLimit: 300,
    can: ['Болтать и играть', 'Простые бытовые вопросы', 'Короткие тексты до 300 символов'],
  },
  smart: {
    name: 'Умный',
    from: IQ_SMART,
    to: IQ_GENIUS - 1,
    textLimit: 2000,
    can: ['Большинство вопросов', 'Объяснения средней глубины', 'Тексты до 2000 символов'],
  },
  genius: {
    name: 'Гений',
    from: IQ_GENIUS,
    to: 100,
    textLimit: 6000,
    can: ['Любые вопросы и глубокий разбор', 'Сложный код, анализ, эксперты', 'Тексты до 6000 символов'],
  },
};

export const iqLevel = (iq: number): IqLevel => (iq >= IQ_GENIUS ? 'genius' : iq >= IQ_SMART ? 'smart' : 'baby');

export const iqNext = (iq: number): { level: IqLevel; need: number } | null => {
  const l = iqLevel(iq);
  if (l === 'baby') return { level: 'smart', need: Math.ceil(IQ_SMART - iq) };
  if (l === 'smart') return { level: 'genius', need: Math.ceil(IQ_GENIUS - iq) };
  return null;
};

export const IQ_UP_PHRASE: Record<Exclude<IqLevel, 'baby'>, string> = {
  smart: 'Я стал Умным!',
  genius: 'Я стал Гением!',
};

export const IQ_UP_HINT: Record<Exclude<IqLevel, 'baby'>, string> = {
  smart: 'Теперь я понимаю больше — спрашивай смелее!',
  genius: 'Теперь я знаю всё — спрашивай о чём угодно!',
};

const ORDER: IqLevel[] = ['baby', 'smart', 'genius'];
export const iqRankIndex = (l: IqLevel) => ORDER.indexOf(l);
