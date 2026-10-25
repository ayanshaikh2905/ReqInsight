import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';

const AnalysisContext = createContext(null);

export function AnalysisProvider({ children }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentDoc, setCurrentDoc] = useState(null);

  const progressTimer = useRef(null);
  const resetTimer = useRef(null);
  const runId = useRef(0);

  const stopTimers = useCallback(() => {
    clearInterval(progressTimer.current);
    clearTimeout(resetTimer.current);
  }, []);

  useEffect(() => stopTimers, [stopTimers]);

  // The backend runs the pipeline in one request and reports no intermediate
  // state, so progress eases toward ~92% and snaps to 100% on completion.
  const startProgress = useCallback(() => {
    stopTimers();
    setProgress(0);
    let p = 0;
    progressTimer.current = setInterval(() => {
      p += (92 - p) * 0.06 + 0.4;
      setProgress(Math.min(92, Math.round(p)));
    }, 220);
  }, [stopTimers]);

  const finishProgress = useCallback(() => {
    clearInterval(progressTimer.current);
    setProgress(100);
    resetTimer.current = setTimeout(() => setProgress(0), 700);
  }, []);

  const runAnalysis = useCallback(
    async (task, docLabel) => {
      const id = ++runId.current;
      setLoading(true);
      setError(null);
      setCurrentDoc(docLabel);
      startProgress();
      try {
        const result = await task();
        if (id === runId.current) {
          setAnalysis(result);
          setCurrentDoc(result?.document_name || docLabel);
        }
        return result;
      } catch (e) {
        if (id === runId.current) {
          setError(e.message || 'Analysis failed.');
          setCurrentDoc(null);
        }
        throw e;
      } finally {
        if (id === runId.current) {
          setLoading(false);
          finishProgress();
        }
      }
    },
    [startProgress, finishProgress],
  );

  const loadDemo = useCallback(() => runAnalysis(() => api.loadDemoSRS(), 'Demo SRS'), [runAnalysis]);

  const uploadFile = useCallback(
    (file, threshold) => runAnalysis(() => api.uploadDocument(file, threshold), file.name),
    [runAnalysis],
  );

  const analyzeText = useCallback(
    (text, name) => runAnalysis(() => api.analyzeText(text, name), name || 'Pasted SRS'),
    [runAnalysis],
  );

  const clearAnalysis = useCallback(() => {
    runId.current += 1;
    stopTimers();
    setAnalysis(null);
    setCurrentDoc(null);
    setError(null);
    setLoading(false);
    setProgress(0);
  }, [stopTimers]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      analysis, loading, error, progress, currentDoc,
      loadDemo, uploadFile, analyzeText, clearAnalysis, clearError,
    }),
    [analysis, loading, error, progress, currentDoc, loadDemo, uploadFile, analyzeText, clearAnalysis, clearError],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used inside <AnalysisProvider>');
  return ctx;
}
