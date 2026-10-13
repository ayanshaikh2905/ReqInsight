import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { AnalysisProvider } from './context/AnalysisContext';
import Layout from './components/Layout';
import { Spinner } from './components/Card';

// Pages are split into their own chunks so the first load only fetches the current route.
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
const History = lazy(() => import('./pages/History'));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner size="lg" />
    </div>
  );
}

function page(Component) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

function NotFound() {
  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="text-center">
        <FileQuestion className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-white">Page not found</h1>
        <p className="text-sm text-slate-400 mt-1 mb-4">That ReqInsight page does not exist.</p>
        <Link to="/" className="inline-flex px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Back to Dashboard</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AnalysisProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={page(Dashboard)} />
            <Route path="/upload" element={page(UploadSRS)} />
            <Route path="/requirements" element={page(Requirements)} />
            <Route path="/duplicates" element={page(Duplicates)} />
            <Route path="/conflicts" element={page(Conflicts)} />
            <Route path="/quality" element={page(QualityAnalysis)} />
            <Route path="/artifacts" element={page(Artifacts)} />
            <Route path="/report" element={page(Report)} />
            <Route path="/history" element={page(History)} />
            <Route path="/evaluation" element={page(Evaluation)} />
            <Route path="/settings" element={page(SettingsPage)} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AnalysisProvider>
  );
}
