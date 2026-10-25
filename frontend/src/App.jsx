import { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AnalysisProvider } from './context/AnalysisContext';
import Layout from './components/Layout';
import { EmptyState } from './components/Card';
import { LinkButton } from './components/Button';
import { usePageTitle } from './hooks/usePageTitle';

// Each page is its own chunk so the charting code only loads when needed.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const UploadSRS = lazy(() => import('./pages/UploadSRS'));
const Requirements = lazy(() => import('./pages/Requirements'));
const Duplicates = lazy(() => import('./pages/Duplicates'));
const Conflicts = lazy(() => import('./pages/Conflicts'));
const QualityAnalysis = lazy(() => import('./pages/QualityAnalysis'));
const Artifacts = lazy(() => import('./pages/Artifacts'));
const Report = lazy(() => import('./pages/Report'));
const Evaluation = lazy(() => import('./pages/Evaluation'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function NotFound() {
  usePageTitle('Page not found');
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="That address doesn't match anything in ReqInsight."
      action={<LinkButton to="/" variant="primary">Back to the dashboard</LinkButton>}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AnalysisProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="/upload" element={<UploadSRS />} />
                <Route path="/requirements" element={<Requirements />} />
                <Route path="/duplicates" element={<Duplicates />} />
                <Route path="/conflicts" element={<Conflicts />} />
                <Route path="/quality" element={<QualityAnalysis />} />
                <Route path="/artifacts" element={<Artifacts />} />
                <Route path="/report" element={<Report />} />
                <Route path="/evaluation" element={<Evaluation />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AnalysisProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
