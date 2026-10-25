import { useMemo } from 'react';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Renders text with highlighter-pen marks over the given terms (case-insensitive). */
export function MarkedText({ text, terms = [], tone = 'warn', className = '' }) {
  const parts = useMemo(() => {
    const clean = [...new Set(terms.map((t) => String(t).trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
    if (!clean.length || !text) return [{ text, marked: false }];
    const re = new RegExp(`(${clean.map(escapeRegExp).join('|')})`, 'gi');
    return String(text)
      .split(re)
      .filter((s) => s !== '')
      .map((s) => ({ text: s, marked: clean.some((t) => t.toLowerCase() === s.toLowerCase()) }));
  }, [text, terms]);

  return (
    <p className={className}>
      {parts.map((p, i) =>
        p.marked ? (
          <mark key={i} className={`marker ${tone === 'bad' ? 'marker-bad' : ''}`} style={{ animationDelay: `${180 + i * 90}ms` }}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}
