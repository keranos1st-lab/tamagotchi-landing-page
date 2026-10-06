// @ts-expect-error bun:test доступен только при запуске через bun
import { afterAll, beforeEach, describe, expect, jest, test } from 'bun:test';
import { Window } from 'happy-dom';

const g = globalThis as unknown as Record<string, unknown>;
const saved: Record<string, PropertyDescriptor | undefined> = {};
const KEYS = ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'Node', 'Element', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];

const win = new Window({ url: 'http://localhost/' });
for (const k of KEYS) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
const w = win as unknown as Record<string, unknown>;
for (const k of KEYS) {
  if (k === 'window') g.window = win;
  else if (k === 'IS_REACT_ACT_ENVIRONMENT') g[k] = true;
  else if (k === 'requestAnimationFrame') g[k] = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16);
  else if (k === 'cancelAnimationFrame') g[k] = (id: number) => clearTimeout(id);
  else Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: k === 'getComputedStyle' ? (w[k] as () => unknown).bind(win) : w[k] });
}

const rtl = await import('@testing-library/react');
const { MiniGames } = await import('./MiniGames');
const { usePetStore } = await import('@/store/petStore');
const { useAchievementStore } = await import('@/store/achievementStore');

afterAll(() => {
  rtl.cleanup();
  for (const k of KEYS) {
    if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!);
    else delete g[k];
  }
});

const CORRECT = [1, 3, 2, 1, 1, 1, 2, 1];
const setEnergy = (energy: number) => usePetStore.setState({ energy, hasSelectedPet: true, type: 'cat', name: 'Тест', exp: 0, level: 1, xpLog: { day: '', counts: {} } } as never);
const energy = () => usePetStore.getState().energy;
const exp = () => usePetStore.getState().exp;
const plays = () => usePetStore.getState().xpLog.counts['game:quiz'] ?? 0;
const ach = () => {
  const s = useAchievementStore.getState();
  return JSON.stringify({ c: s.counters, u: s.unlocked, g: (s as unknown as { games?: unknown }).games });
};
const advance = async (ms: number) => {
  await rtl.act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

type View = ReturnType<typeof rtl.render>;
const answers = (v: View) => Array.from(v.container.querySelectorAll('.pa-field button')) as HTMLButtonElement[];
const answer = (v: View, i: number) => rtl.fireEvent.click(answers(v)[i]);
const counter = (v: View) => v.container.textContent?.match(/(\d)\/8/)?.[1];
const openQuiz = () => {
  const v = rtl.render(<MiniGames />);
  rtl.fireEvent.click(v.getByText('Викторина'));
  return v;
};
const goToLast = async (v: View) => {
  for (let q = 0; q < 7; q++) {
    answer(v, CORRECT[q]);
    await advance(1500);
  }
  expect(counter(v)).toBe('8');
};

beforeEach(() => {
  jest.useFakeTimers();
  rtl.cleanup();
  setEnergy(80);
  useAchievementStore.setState({ counters: {}, unlocked: {}, games: {} } as never);
});

describe('Викторина: отложенные действия', () => {
  test('обычное завершение: итоги появляются, награда и энергия ровно один раз', async () => {
    const v = openQuiz();
    await goToLast(v);
    answer(v, CORRECT[7]);
    await advance(1499);
    expect(v.queryByText('Готово')).toBeNull();
    expect(energy()).toBe(80);
    await advance(1);
    expect(v.getByText('Готово')).toBeTruthy();
    expect(v.getByText('8 из 8')).toBeTruthy();
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(exp()).toBe(40);
    const a = ach();
    await advance(20000);
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(exp()).toBe(40);
    expect(ach()).toBe(a);
    expect(useAchievementStore.getState().counters.games).toBe(1);
    expect(useAchievementStore.getState().counters.quizPerfect).toBe(1);
    expect(useAchievementStore.getState().counters.gameWins).toBe(1);
  });

  test('формула награды сохранена: 5 опыта за правильный ответ', async () => {
    const v = openQuiz();
    for (let q = 0; q < 8; q++) {
      answer(v, q < 2 ? CORRECT[q] : (CORRECT[q] + 1) % 4);
      await advance(1500);
    }
    expect(v.getByText('2 из 8')).toBeTruthy();
    expect(exp()).toBe(10);
    expect(useAchievementStore.getState().counters.quizPerfect).toBeUndefined();
  });

  test('задержка показа ответа 1500 мс: вопрос не меняется раньше', async () => {
    const v = openQuiz();
    answer(v, CORRECT[0]);
    await advance(1499);
    expect(counter(v)).toBe('1');
    await advance(1);
    expect(counter(v)).toBe('2');
  });

  test('выход после обычного ответа до истечения задержки: старый таймер не влияет на новую игру', async () => {
    const v = openQuiz();
    answer(v, CORRECT[0]);
    await advance(500);
    rtl.fireEvent.click(v.container.querySelector('button[title="Назад к играм"]')!);
    expect(v.getByText('Викторина')).toBeTruthy();
    rtl.fireEvent.click(v.getByText('Викторина'));
    expect(counter(v)).toBe('1');
    await advance(5000);
    expect(counter(v)).toBe('1');
    expect(answers(v).every((b) => !b.disabled)).toBe(true);
    expect(v.container.textContent).not.toContain('Идеально');
    expect(energy()).toBe(80);
    expect(exp()).toBe(0);
  });

  test('выход после последнего ответа до истечения задержки: опыт, энергия и достижения не меняются позднее', async () => {
    const v = openQuiz();
    await goToLast(v);
    const a = ach();
    answer(v, CORRECT[7]);
    await advance(700);
    rtl.fireEvent.click(v.container.querySelector('button[title="Назад к играм"]')!);
    await advance(30000);
    expect(energy()).toBe(80);
    expect(exp()).toBe(0);
    expect(plays()).toBe(0);
    expect(ach()).toBe(a);
    expect(useAchievementStore.getState().counters.games).toBeUndefined();
  });

  test('размонтирование без выхода через кнопку тоже отменяет таймер', async () => {
    const v = openQuiz();
    await goToLast(v);
    answer(v, CORRECT[7]);
    v.unmount();
    await advance(30000);
    expect(energy()).toBe(80);
    expect(plays()).toBe(0);
    expect(useAchievementStore.getState().counters.games).toBeUndefined();
  });

  test('повторные нажатия ответа не создают несколько таймеров и наград', async () => {
    const v = openQuiz();
    await goToLast(v);
    const before = jest.getTimerCount();
    answer(v, CORRECT[7]);
    expect(jest.getTimerCount()).toBe(before + 1);
    for (let i = 0; i < 4; i++) answer(v, i);
    rtl.fireEvent.click(answers(v)[CORRECT[7]]);
    expect(jest.getTimerCount()).toBe(before + 1);
    await advance(1500);
    await advance(10000);
    expect(energy()).toBe(72);
    expect(plays()).toBe(1);
    expect(exp()).toBe(40);
    expect(useAchievementStore.getState().counters.games).toBe(1);
  });

  test('повторные нажатия на обычном вопросе не перескакивают через вопросы и не меняют счёт', async () => {
    const v = openQuiz();
    answer(v, CORRECT[0]);
    answer(v, CORRECT[0]);
    answer(v, CORRECT[0]);
    await advance(1500);
    expect(counter(v)).toBe('2');
    await advance(5000);
    expect(counter(v)).toBe('2');
    expect(v.container.textContent).toContain('1');
    answer(v, CORRECT[1]);
    await advance(1500);
    expect(counter(v)).toBe('3');
  });

  test('после выхода и новой игры награда новой игры начисляется один раз, старая не добавляется', async () => {
    const v = openQuiz();
    await goToLast(v);
    answer(v, CORRECT[7]);
    await advance(300);
    rtl.fireEvent.click(v.container.querySelector('button[title="Назад к играм"]')!);
    rtl.fireEvent.click(v.getByText('Викторина'));
    await goToLast(v);
    answer(v, CORRECT[7]);
    await advance(1500);
    await advance(10000);
    expect(plays()).toBe(1);
    expect(energy()).toBe(72);
    expect(v.getByText('8 из 8')).toBeTruthy();
  });

  test('низкая энергия: итоги викторины остаются видны', async () => {
    setEnergy(12);
    const v = openQuiz();
    await goToLast(v);
    answer(v, CORRECT[7]);
    await advance(1500);
    expect(energy()).toBe(4);
    expect(v.getByText('Готово')).toBeTruthy();
    expect(v.queryByText('Нет сил играть')).toBeNull();
  });
});
