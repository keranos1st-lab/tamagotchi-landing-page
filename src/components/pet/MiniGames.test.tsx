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

afterAll(() => {
  rtl.cleanup();
  for (const k of KEYS) {
    if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!);
    else delete g[k];
  }
});

const setEnergy = (energy: number) => usePetStore.setState({ energy, hasSelectedPet: true, type: 'cat', name: 'Тест', exp: 0, level: 1, xpLog: { day: '', counts: {} } } as never);
const energy = () => usePetStore.getState().energy;
const exp = () => usePetStore.getState().exp;

const advance = async (ms: number) => {
  await rtl.act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

const openChase = () => {
  const view = rtl.render(<MiniGames />);
  rtl.fireEvent.click(view.getByText('Догонялки'));
  return view;
};

const finishChase = async (view: ReturnType<typeof openChase>) => {
  const field = view.container.querySelector('.pa-field') as HTMLElement;
  field.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 320, right: 400, bottom: 320, x: 0, y: 0, toJSON() {} }) as DOMRect;
  rtl.fireEvent.click(view.getByText('Старт'));
  rtl.fireEvent.mouseMove(field, { clientX: 380, clientY: 300 });
  await advance(31000);
};

beforeEach(() => {
  jest.useFakeTimers();
  rtl.cleanup();
  setEnergy(80);
});

describe('мини-игры: энергия при запуске и после завершения', () => {
  test('при энергии ниже 10 игра изначально не запускается', () => {
    setEnergy(9);
    const view = rtl.render(<MiniGames />);
    expect(view.getByText('Нет сил играть')).toBeTruthy();
    expect(view.queryByText('Догонялки')).toBeNull();
  });

  test('при энергии ровно 10 запуск доступен', () => {
    setEnergy(10);
    const view = openChase();
    expect(view.getByText('Готов бежать?')).toBeTruthy();
    expect(view.queryByText('Нет сил играть')).toBeNull();
  });

  test('старт при 12 → завершение → энергия 4, итоги остаются видны', async () => {
    setEnergy(12);
    const view = openChase();
    await finishChase(view);
    expect(energy()).toBe(4);
    expect(view.getByText('Готово')).toBeTruthy();
    expect(view.getByText(/Ни разу не пойман/)).toBeTruthy();
    expect(view.queryByText('Нет сил играть')).toBeNull();
    await advance(5000);
    expect(view.getByText('Готово')).toBeTruthy();
  });

  test('при энергии 4 на экране итогов нет кнопки «Ещё раз»', async () => {
    setEnergy(12);
    const view = openChase();
    await finishChase(view);
    expect(view.queryByText('Ещё раз')).toBeNull();
  });

  test('после выхода из итогов при энергии 4 новую игру запустить нельзя', async () => {
    setEnergy(12);
    const view = openChase();
    await finishChase(view);
    rtl.fireEvent.click(view.getByText('Готово'));
    expect(view.getByText('Нет сил играть')).toBeTruthy();
    expect(view.queryByText('Догонялки')).toBeNull();
    expect(energy()).toBe(4);
  });

  test('при достаточной энергии «Ещё раз» доступна и перезапускает игру', async () => {
    setEnergy(80);
    const view = openChase();
    await finishChase(view);
    expect(energy()).toBe(72);
    rtl.fireEvent.click(view.getByText('Ещё раз'));
    expect(view.queryByText('Готово')).toBeNull();
    expect(energy()).toBe(72);
  });

  test('при достаточной энергии запуск и завершение работают как прежде, награда начисляется один раз', async () => {
    setEnergy(80);
    const view = openChase();
    const e0 = exp();
    await finishChase(view);
    const e1 = exp();
    expect(energy()).toBe(72);
    expect(e1).toBeGreaterThan(e0);
    await advance(10000);
    view.rerender(<MiniGames />);
    await advance(10000);
    expect(exp()).toBe(e1);
    expect(energy()).toBe(72);
    rtl.fireEvent.click(view.getByText('Готово'));
    expect(view.getByText('Догонялки')).toBeTruthy();
    expect(exp()).toBe(e1);
    expect(energy()).toBe(72);
  });

  test('снижение энергии извне во время игры не прячет активную игру', async () => {
    setEnergy(30);
    const view = openChase();
    rtl.fireEvent.click(view.getByText('Старт'));
    await advance(2000);
    expect(view.getByText(/Пауза/)).toBeTruthy();
    await rtl.act(async () => {
      usePetStore.setState({ energy: 3 });
    });
    expect(view.queryByText('Нет сил играть')).toBeNull();
    expect(view.getByText(/Убегай курсором/)).toBeTruthy();
  });

  test('«Ещё раз» не стартует, если энергия упала ниже 10', async () => {
    setEnergy(30);
    const view = openChase();
    await finishChase(view);
    expect(energy()).toBe(22);
    await rtl.act(async () => {
      usePetStore.setState({ energy: 5 });
    });
    expect(view.queryByText('Ещё раз')).toBeNull();
  });
});
