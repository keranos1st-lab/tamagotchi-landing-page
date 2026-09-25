import { Fragment, useState, type ReactNode } from 'react';
import Icon from '@/components/ui/icon';

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-bold text-white">{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`'))
      return (
        <code key={i} className="rounded bg-black/30 px-1 py-0.5 font-mono text-[12px] text-cyan-200">
          {p.slice(1, -1)}
        </code>
      );
    return <Fragment key={i}>{p}</Fragment>;
  });
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/10 bg-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
        {lang || 'код'}
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 normal-case tracking-normal text-white/50 hover:text-white"
        >
          <Icon name={copied ? 'Check' : 'Copy'} size={11} />
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-cyan-100">{code}</pre>
    </div>
  );
}

export function RichText({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <div className="space-y-1.5 whitespace-normal">
      {blocks.map((block, bi) => {
        if (bi % 2 === 1) {
          const nl = block.indexOf('\n');
          const lang = nl > -1 ? block.slice(0, nl).trim() : '';
          const code = nl > -1 ? block.slice(nl + 1).replace(/\n$/, '') : block;
          return <CodeBlock key={bi} code={code} lang={lang} />;
        }
        return block
          .split('\n')
          .map((line, li) => {
            const t = line.trim();
            if (!t) return null;
            const key = `${bi}-${li}`;
            const h = t.match(/^#{1,4}\s+(.*)/);
            if (h) return <div key={key} className="pt-1 font-bold text-white">{inline(h[1])}</div>;
            const ul = t.match(/^[-*•]\s+(.*)/);
            if (ul)
              return (
                <div key={key} className="flex gap-2 pl-1">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-pink-300" />
                  <span>{inline(ul[1])}</span>
                </div>
              );
            const ol = t.match(/^(\d+)[.)]\s+(.*)/);
            if (ol)
              return (
                <div key={key} className="flex gap-2 pl-1">
                  <span className="shrink-0 font-bold text-pink-300">{ol[1]}.</span>
                  <span>{inline(ol[2])}</span>
                </div>
              );
            return <p key={key}>{inline(t)}</p>;
          });
      })}
    </div>
  );
}
