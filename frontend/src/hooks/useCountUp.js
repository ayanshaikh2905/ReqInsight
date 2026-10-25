import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** Eases a number from its previous value to `target` (exponential ease-out). */
export function useCountUp(target, { duration = 1000, delay = 0 } = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced || !Number.isFinite(target) ? target : 0);
  const current = useRef(value);

  useEffect(() => {
    if (!Number.isFinite(target) || reduced) return undefined;
    const from = current.current;
    const begin = performance.now() + delay;
    let frame;
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - begin) / duration));
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const next = from + (target - from) * eased;
      current.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, delay, reduced]);

  return reduced || !Number.isFinite(target) ? target : value;
}
