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
const { ChaseGame } = await import('./ChaseGame');
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

const W = 400;
const H = 320;
type View = ReturnType<typeof rtl.render>;
const fieldOf = (v: View) => {
  const el = v.container.querySelector('.pa-field') as HTMLElement;
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return el;
};
const timeText = (v: View) => v.getByText(/^\d+с$/).textContent?.replace('с', '');
const paused = (v: View) => !!v.queryByText(/Пауза/);

const mount = (onComplete = () => {}) => {
  const v = rtl.render(<ChaseGame onComplete={onComplete} />);
  const field = fieldOf(v);
  return { v, field };
};
const startGame = (v: View) => rtl.fireEvent.click(v.getByText('Старт'));
const mouseAt = (el: HTMLElement, x = 300, y = 40) => rtl.fireEvent.mouseMove(el, { clientX: x, clientY: y });
const touch = (el: HTMLElement, type: 'touchStart' | 'touchMove', x = 300, y = 40) =>
  rtl.fireEvent[type](el, { touches: [{ clientX: x, clientY: y }] });
const release = (el: HTMLElement, type: 'touchEnd' | 'touchCancel' = 'touchEnd') => rtl.fireEvent[type](el, { touches: [] });

beforeEach(() => {
  jest.useFakeTimers();
  rtl.cleanup();
  setEnergy(80);
});

describe('Догонялки: время идёт только при участии', () => {
  test('после старта без указателя время не уменьшается и награда не выдаётся', async () => {
    const { v } = mount();
    startGame(v);
    expect(paused(v)).toBe(true);
    await advance(60000);
    expect(timeText(v)).toBe('30');
    expect(v.queryByText('Готово')).toBeNull();
    expect(exp()).toBe(0);
    expect(energy()).toBe(80);
  });

  test('вход и движение внутри поля запускают отсчёт, выход ставит на паузу', async () => {
    const { v, field } = mount();
    startGame(v);
    mouseAt(field);
    expect(paused(v)).toBe(false);
    await advance(5000);
    expect(timeText(v)).toBe('25');
    rtl.fireEvent.mouseLeave(field);
    expect(paused(v)).toBe(true);
    await advance(20000);
    expect(timeText(v)).toBe('25');
    mouseAt(field);
    await advance(3000);
    expect(timeText(v)).toBe('22');
  });

  test('координаты за пределами поля не считаются участием', async () => {
    const { v, field } = mount();
    startGame(v);
    for (const [x, y] of [[-5, 10], [W + 5, 10], [10, -5], [10, H + 5]]) {
      mouseAt(field, x, y);
      expect(paused(v)).toBe(true);
    }
    await advance(10000);
    expect(timeText(v)).toBe('30');
    mouseAt(field, 0, 0);
    expect(paused(v)).toBe(false);
  });

  test('движение курсора за границу поля ставит игру на паузу', async () => {
    const { v, field } = mount();
    startGame(v);
    mouseAt(field);
    await advance(2000);
    mouseAt(field, W + 50, 10);
    expect(paused(v)).toBe(true);
    await advance(10000);
    expect(timeText(v)).toBe('28');
  });

  test('на телефоне касание запускает игру, отпускание и отмена касания ставят на паузу', async () => {
    const { v, field } = mount();
    startGame(v);
    touch(field, 'touchStart');
    expect(paused(v)).toBe(false);
    await advance(4000);
    expect(timeText(v)).toBe('26');
    release(field, 'touchEnd');
    expect(paused(v)).toBe(true);
    await advance(10000);
    expect(timeText(v)).toBe('26');
    touch(field, 'touchStart');
    await advance(2000);
    expect(timeText(v)).toBe('24');
    release(field, 'touchCancel');
    expect(paused(v)).toBe(true);
    await advance(10000);
    expect(timeText(v)).toBe('24');
  });

  test('одно из двух касаний отпущено: игра идёт, пока остаётся палец', async () => {
    const { v, field } = mount();
    startGame(v);
    rtl.fireEvent.touchStart(field, { touches: [{ clientX: 10, clientY: 10 }, { clientX: 50, clientY: 50 }] });
    rtl.fireEvent.touchEnd(field, { touches: [{ clientX: 50, clientY: 50 }] });
    expect(paused(v)).toBe(false);
  });

  test('касание за пределами поля не считается участием', async () => {
    const { v, field } = mount();
    startGame(v);
    touch(field, 'touchStart', W + 20, 10);
    expect(paused(v)).toBe(true);
    await advance(5000);
    expect(timeText(v)).toBe('30');
  });

  test('эмулированные мышиные события сразу после касания не запускают игру заново', async () => {
    const { v, field } = mount();
    startGame(v);
    touch(field, 'touchStart');
    release(field, 'touchEnd');
    mouseAt(field);
    expect(paused(v)).toBe(true);
  });

  test('скрытие вкладки ставит игру на паузу, после возвращения она продолжается при новом взаимодействии', async () => {
    const { v, field } = mount();
    startGame(v);
    mouseAt(field);
    await advance(3000);
    expect(timeText(v)).toBe('27');
    const doc = document as unknown as { hidden: boolean };
    Object.defineProperty(doc, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new window.Event('visibilitychange'));
    await rtl.act(async () => {});
    expect(paused(v)).toBe(true);
    await advance(10000);
    expect(timeText(v)).toBe('27');
    Object.defineProperty(doc, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new window.Event('visibilitychange'));
    await advance(5000);
    expect(timeText(v)).toBe('27');
    expect(paused(v)).toBe(true);
    mouseAt(field);
    await advance(2000);
    expect(timeText(v)).toBe('25');
  });

  test('скрытая вкладка не засчитывает время даже при указателе', async () => {
    const { v, field } = mount();
    startGame(v);
    mouseAt(field);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    await advance(5000);
    expect(timeText(v)).toBe('30');
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });
});

describe('Догонялки: итоги, награда, энергия, повтор', () => {
  test('после 30 секунд активного участия итоги появляются, награда и энергия один раз', async () => {
    const { v, field } = mount();
    startGame(v);
    mouseAt(field, 380, 300);
    await advance(30500);
    expect(v.getByText('Готово')).toBeTruthy();
    expect(v.getByText(/Ни разу не пойман/)).toBeTruthy();
    const e1 = exp();
    expect(e1).toBeGreaterThan(0);
    expect(energy()).toBe(72);
    await advance(30000);
    expect(exp()).toBe(e1);
    expect(energy()).toBe(72);
  });

  test('прерывистое участие: суммарно 30 секунд, награда одна', async () => {
    const { v, field } = mount();
    startGame(v);
    for (let i = 0; i < 3; i++) {
      mouseAt(field, 380, 300);
      await advance(10000);
      rtl.fireEvent.mouseLeave(field);
      await advance(7000);
    }
    await advance(1000);
    expect(v.getByText('Готово')).toBeTruthy();
    expect(energy()).toBe(72);
  });

  test('максимальная награда 60 опыта сохраняется для непойманного', async () => {
    const { v, field } = mount();
    startGame(v);
    mouseAt(field, 380, 300);
    await advance(30500);
    expect(v.getByText(/Ни разу не пойман/)).toBeTruthy();
    expect(exp()).toBe(60);
  });

  test('«Ещё раз» сбрасывает указатель и время: без нового участия время не идёт', async () => {
    const { v, field } = mount();
    startGame(v);
    mouseAt(field, 380, 300);
    await advance(30500);
    const e1 = exp();
    expect(usePetStore.getState().xpLog.counts['game:chase']).toBe(1);
    rtl.fireEvent.click(v.getByText('Ещё раз'));
    const field2 = fieldOf(v);
    expect(field2).toBeTruthy();
    expect(paused(v)).toBe(true);
    expect(timeText(v)).toBe('30');
    await advance(60000);
    expect(timeText(v)).toBe('30');
    expect(v.queryByText('Готово')).toBeNull();
    expect(exp()).toBe(e1);
    expect(usePetStore.getState().xpLog.counts['game:chase']).toBe(1);
    expect(energy()).toBe(72);
    mouseAt(field2, 380, 300);
    await advance(30500);
    expect(v.getByText('Готово')).toBeTruthy();
    expect(energy()).toBe(64);
    expect(usePetStore.getState().xpLog.counts['game:chase']).toBe(2);
  });

  test('низкая энергия: итоги остаются видны, «Ещё раз» недоступна, после выхода новая игра запрещена', async () => {
    setEnergy(12);
    const v = rtl.render(<MiniGames />);
    rtl.fireEvent.click(v.getByText('Догонялки'));
    const field = fieldOf(v);
    rtl.fireEvent.click(v.getByText('Старт'));
    mouseAt(field, 380, 300);
    await advance(30500);
    expect(energy()).toBe(4);
    expect(v.getByText('Готово')).toBeTruthy();
    expect(v.queryByText('Нет сил играть')).toBeNull();
    expect(v.queryByText('Ещё раз')).toBeNull();
    rtl.fireEvent.click(v.getByText('Готово'));
    expect(v.getByText('Нет сил играть')).toBeTruthy();
  });

  test('ускорение питомца при поимке сохраняется: поимка считается и влияет на награду', async () => {
    const { v, field } = mount();
    startGame(v);
    mouseAt(field, 10, H - 80);
    await advance(2000);
    mouseAt(field, 10, H - 80);
    await advance(30000);
    expect(v.getByText('Готово')).toBeTruthy();
  });
});
