import type { PetType } from '@/store/petStore';

const WORD: Partial<Record<PetType, string>> = {
  fox: 'Фыр-фыр',
  dragon: 'Р-р-р',
};

const EXTRA: Partial<Record<PetType, string[]>> = {
  dragon: ['Огонёк внутри греется!', 'Р-р-р, щекотно!', 'Ещё почеши!'],
};

export const purrWord = (type: PetType) => WORD[type] ?? 'Мррр';

export const purrPhrase = (type: PetType, base: string) => {
  const w = WORD[type];
  return w ? base.replace('Мррр', w) : base;
};

export const petExtraPhrases = (type: PetType) => EXTRA[type] ?? [];
