import { useState } from 'react';

/**
 * Animated disclosure. Children mount on first open (so long lists stay cheap)
 * and the content is `inert` while closed so it can't be tabbed into.
 */
export function Collapse({ open, id, children }) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  return (
    <div
      id={id}
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="min-h-0 overflow-hidden">{mounted && children}</div>
    </div>
  );
}
