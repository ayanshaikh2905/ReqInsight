import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity, BookOpen, ChevronsLeft, ChevronsRight, Copy, FileText, GitMerge, LayoutDashboard,
  History as HistoryIcon, Menu, Moon, Settings, Sparkles, Star, Sun, Upload, X,
} from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { useTheme } from '../context/ThemeContext';
import { bandFor, TONE } from '../lib/quality';
import { ErrorBoundary } from './ErrorBoundary';
import { RouteFallback } from './RouteFallback';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/upload', icon: Upload, label: 'Upload SRS' },
    ],
  },
  {
    label: 'Review',
    items: [
      { to: '/requirements', icon: FileText, label: 'Requirements' },
      { to: '/duplicates', icon: Copy, label: 'Duplicates', count: (a) => a.summary?.duplicate_pairs_count },
      { to: '/conflicts', icon: GitMerge, label: 'Conflicts', count: (a) => a.summary?.conflict_pairs_count, tone: 'bad' },
      { to: '/quality', icon: Star, label: 'Quality' },
    ],
  },
  {
    label: 'Output',
    items: [
      { to: '/artifacts', icon: Sparkles, label: 'Artifacts' },
      { to: '/report', icon: BookOpen, label: 'Report' },
      { to: '/history', icon: HistoryIcon, label: 'History & Compare' },
      { to: '/evaluation', icon: Activity, label: 'Evaluation' },
    ],
  },
  {
    label: 'App',
    items: [{ to: '/settings', icon: Settings, label: 'Settings' }],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function activeKey(pathname) {
  const hit = ALL_ITEMS.find((i) => (i.to === '/' ? pathname === '/' : pathname === i.to || pathname.startsWith(`${i.to}/`)));
  return hit?.to ?? null;
}

function readCollapsed() {
  try {
    return localStorage.getItem('reqinsight-nav-collapsed') === '1';
  } catch {
    return false;
  }
}

function SidebarBody({ collapsed, onNavigate }) {
  const { analysis, currentDoc } = useAnalysis();
  const { pathname } = useLocation();
  const navRef = useRef(null);
  const itemRefs = useRef({});
  const [indicator, setIndicator] = useState(null);
  const current = activeKey(pathname);

  const measure = useCallback(() => {
    const el = current && itemRefs.current[current];
    if (!el) return setIndicator(null);
    setIndicator({ top: el.offsetTop, height: el.offsetHeight });
  }, [current]);

  useLayoutEffect(measure, [measure, collapsed, analysis]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const score = analysis?.summary?.average_quality_score;

  return (
    <>
      <div className={`flex h-16 shrink-0 items-center ${collapsed ? 'justify-center' : 'px-5'}`}>
        {collapsed ? (
          <span className="font-display text-lg font-semibold text-ink" aria-hidden="true">R</span>
        ) : (
          <div>
            <div className="font-display text-lg font-semibold leading-none tracking-tight text-ink">ReqInsight</div>
            <div className="mt-1 text-xs text-faint">Requirements review</div>
          </div>
        )}
      </div>

      {!collapsed && currentDoc && (
        <NavLink
          to="/"
          onClick={onNavigate}
          className="mx-3 mb-2 block rounded-lg border border-line bg-raised px-3 py-2.5 transition-colors hover:border-faint"
        >
          <div className="truncate text-xs font-medium text-ink" title={currentDoc}>{currentDoc}</div>
          {analysis && (
            <div className="mt-1 flex items-center gap-2 text-xs text-muted">
              <span>{analysis.summary?.total_requirements} requirements</span>
              {typeof score === 'number' && (
                <span className={`font-mono ${TONE[bandFor(score).tone].text}`}>{score}</span>
              )}
            </div>
          )}
        </NavLink>
      )}

      <nav ref={navRef} aria-label="Primary" className="relative flex-1 overflow-y-auto px-2 pb-3">
        {indicator && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 w-[3px] rounded-r-full bg-accent transition-[transform,height] duration-300 ease-out"
            style={{ height: indicator.height - 12, transform: `translateY(${indicator.top + 6}px)` }}
          />
        )}
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mt-3 first:mt-1">
            {!collapsed && <div className="px-3 pb-1.5 text-xs text-faint">{group.label}</div>}
            {collapsed && <div className="mx-3 my-2 h-px bg-line first:hidden" />}
            <ul className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, count, tone }) => {
                const n = analysis && count ? count(analysis) : null;
                return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={to === '/'}
                      ref={(el) => { itemRefs.current[to] = el; }}
                      onClick={onNavigate}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        `group relative flex h-10 items-center gap-3 rounded-lg text-sm transition-colors ${
                          collapsed ? 'justify-center' : 'px-3'
                        } ${isActive ? 'bg-raised font-medium text-ink' : 'text-muted hover:bg-raised/60 hover:text-ink'}`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="flex-1 truncate">{label}</span>}
                      {collapsed && <span className="sr-only">{label}</span>}
                      {n > 0 && (
                        <span
                          key={n}
                          className={`pop-in rounded-md px-1.5 font-mono text-[11px] leading-5 tabular-nums ${
                            tone === 'bad' ? 'bg-bad/15 text-bad' : 'bg-line text-muted'
                          } ${collapsed ? 'absolute right-1 top-1 px-1 text-[10px] leading-4' : ''}`}
                        >
                          {n}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('reqinsight-nav-collapsed', c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });

  // New page: close the mobile drawer and reset scroll.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-300 ease-out lg:flex ${
          collapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        <SidebarBody collapsed={collapsed} />
        <div className={`flex shrink-0 items-center border-t border-line p-2 ${collapsed ? 'flex-col gap-1' : 'justify-between'}`}>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <ThemeIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-40 lg:hidden ${drawerOpen ? '' : 'pointer-events-none'}`} aria-hidden={!drawerOpen}>
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside
          inert={!drawerOpen}
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface transition-transform duration-300 ease-out ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
          <SidebarBody collapsed={false} onNavigate={() => setDrawerOpen(false)} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-ink"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-base font-semibold tracking-tight">ReqInsight</span>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeLabel}
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-ink"
          >
            <ThemeIcon className="h-4 w-4" />
          </button>
        </header>

        <main id="main" ref={mainRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<RouteFallback />}>
              <div key={pathname} className="route-enter mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 lg:py-10">
                <Outlet />
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
