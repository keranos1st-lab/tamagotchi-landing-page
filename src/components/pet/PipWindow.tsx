import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type PipApi = {
  requestWindow: (opts: { width: number; height: number }) => Promise<Window>;
  window: Window | null;
};

export function getPipApi(): PipApi | null {
  const api = (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;
  return api ?? null;
}

function copyStyles(target: Document) {
  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      const css = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
      const style = target.createElement('style');
      style.textContent = css;
      target.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.head.appendChild(link);
      }
    }
  });
}

export async function openPipWindow(width = 280, height = 340): Promise<Window | null> {
  const api = getPipApi();
  if (!api) return null;
  const win = await api.requestWindow({ width, height });
  copyStyles(win.document);
  win.document.title = 'Питомец';
  win.document.body.style.margin = '0';
  return win;
}

export function PipPortal({ win, children }: { win: Window; children: React.ReactNode }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = win.document.createElement('div');
    win.document.body.appendChild(el);
    setRoot(el);
    return () => el.remove();
  }, [win]);

  return root ? createPortal(children, root) : null;
}
