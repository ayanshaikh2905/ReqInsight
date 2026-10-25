# ReqInsight frontend

React 19 + Vite + Tailwind. Talks to the FastAPI backend at `VITE_API_URL` (default `http://localhost:8000/api`).

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build
```

## Structure

- `src/index.css`: design tokens (light and dark themes as CSS variables) and the motion primitives.
- `src/components`: shared UI (buttons, badges, collapse, segmented control, charts, progress view).
- `src/context`: analysis state, theme, toasts.
- `src/pages`: one lazy-loaded chunk per route.
- `src/api/client.js`: fetch wrapper with timeouts, abort support and FastAPI error parsing.

Animation respects `prefers-reduced-motion`. Colours are semantic tokens (`bg-surface`, `text-muted`, `text-ok`, ...), so a new theme only needs new variable values.
