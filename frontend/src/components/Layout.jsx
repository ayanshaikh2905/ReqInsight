import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Upload, FileText, Copy, AlertTriangle,
  Star, Sparkles, BookOpen, Settings, ChevronLeft, ChevronRight,
  Activity, Zap
} from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Upload SRS' },
  { to: '/requirements', icon: FileText, label: 'Requirements' },
  { to: '/duplicates', icon: Copy, label: 'Duplicates' },
  { to: '/conflicts', icon: AlertTriangle, label: 'Conflicts' },
  { to: '/quality', icon: Star, label: 'Quality Analysis' },
  { to: '/artifacts', icon: Sparkles, label: 'Generated Artifacts' },
  { to: '/report', icon: BookOpen, label: 'Report' },
  { to: '/evaluation', icon: Activity, label: 'Evaluation Metrics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { analysis, currentDoc } = useAnalysis();

  return (
    <div className="flex h-screen bg-slate-950 font-['Inter',sans-serif]">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-bold text-white leading-tight">ReqInsight AI</div>
              <div className="text-xs text-slate-400 leading-tight">NLP Requirements Engine</div>
            </div>
          )}
        </div>

        {/* Active doc badge */}
        {!collapsed && currentDoc && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-indigo-950 border border-indigo-800">
            <div className="text-xs text-indigo-400 font-medium truncate">{currentDoc}</div>
            {analysis && (
              <div className="text-xs text-slate-400 mt-0.5">
                {analysis.summary?.total_requirements} requirements
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto px-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-900/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
