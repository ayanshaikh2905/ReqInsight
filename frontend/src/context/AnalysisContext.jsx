import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { api } from '../api/client';

const AnalysisContext = createContext(null);

export function AnalysisProvider({ children }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentDoc, setCurrentDoc] = useState(null);
  const progressTimer = useRef(null);

  const simulateProgress = useCallback(() => {
    setProgress(0);
    let p = 0;
    progressTimer.current = setInterval(() => {
      p = Math.min(p + Math.random() * 12, 88);
      setProgress(Math.round(p));
    }, 300);
  }, []);

  const finishProgress = useCallback(() => {
    clearInterval(progressTimer.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 800);
  }, []);

  const runAnalysis = useCallback(async (fn, docLabel) => {
    setLoading(true);
    setError(null);
    setCurrentDoc(docLabel);
    simulateProgress();
    try {
      const result = await fn();
      setAnalysis(result);
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
      finishProgress();
    }
  }, [simulateProgress, finishProgress]);

  const loadDemo = useCallback(
    () => runAnalysis(() => api.loadDemoSRS(), 'Academic Demo SRS'),
    [runAnalysis]
  );

  const uploadFile = useCallback(
    (file, threshold) =>
      runAnalysis(() => api.uploadDocument(file, threshold), file.name),
    [runAnalysis]
  );

  const analyzeText = useCallback(
    (text, name) =>
      runAnalysis(() => api.analyzeText(text, name), name || 'Pasted SRS'),
    [runAnalysis]
  );

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setCurrentDoc(null);
    setError(null);
  }, []);

  return (
    <AnalysisContext.Provider
      value={{ analysis, loading, error, progress, currentDoc, loadDemo, uploadFile, analyzeText, clearAnalysis }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  return useContext(AnalysisContext);
}
