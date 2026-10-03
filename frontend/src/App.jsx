import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { AnalysisProvider } from './context/AnalysisContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UploadSRS from './pages/UploadSRS';
import Requirements from './pages/Requirements';
import Duplicates from './pages/Duplicates';
import Conflicts from './pages/Conflicts';
import QualityAnalysis from './pages/QualityAnalysis';
import Artifacts from './pages/Artifacts';
import Report from './pages/Report';
import Evaluation from './pages/Evaluation';
import SettingsPage from './pages/SettingsPage';

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
  );
}
