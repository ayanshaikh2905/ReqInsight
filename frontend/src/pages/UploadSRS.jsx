import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, X, AlertCircle, FlaskConical, Keyboard } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { Spinner, PageHeader } from '../components/Card';
import { useNavigate } from 'react-router-dom';

export default function UploadSRS() {
  const { loading, error, progress, uploadFile, analyzeText, loadDemo } = useAnalysis();
  const [file, setFile] = useState(null);
  const [threshold, setThreshold] = useState(0.85);
  const [tab, setTab] = useState('file');
  const [pastedText, setPastedText] = useState('');
  const navigate = useNavigate();

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  const handleAnalyze = async () => {
    try {
      if (tab === 'file' && file) {
        await uploadFile(file, threshold);
      } else if (tab === 'text' && pastedText.trim()) {
        await analyzeText(pastedText, 'Pasted SRS Document');
      }
      navigate('/');
    } catch {}
  };

  const handleDemo = async () => {
    await loadDemo();
    navigate('/');
  };

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="Upload SRS Document"
        subtitle="Upload a Software Requirements Specification (PDF, DOCX, or TXT) for automated NLP analysis"
      />

      {/* Demo Button */}
      <button
        id="btn-demo-srs"
        onClick={handleDemo}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity mb-6 shadow-lg shadow-indigo-900/30 disabled:opacity-50"
      >
        <FlaskConical className="w-4 h-4" />
        🎓 Load Professor Demo SRS — Works Without API Key
      </button>

      <div className="text-center text-xs text-slate-500 mb-6">— or analyze your own document —</div>

      {/* Tab switcher */}
      <div className="flex rounded-lg bg-slate-800 p-1 mb-4">
        <button
          onClick={() => setTab('file')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'file' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <UploadCloud className="w-4 h-4" /> Upload File
        </button>
        <button
          onClick={() => setTab('text')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'text' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Keyboard className="w-4 h-4" /> Paste Text
        </button>
      </div>

      {/* File drop zone */}
      {tab === 'file' && (
        <div
          {...getRootProps()}
          id="dropzone-area"
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-indigo-500 bg-indigo-950/40'
              : file
              ? 'border-emerald-600 bg-emerald-950/20'
              : 'border-slate-700 hover:border-indigo-600 hover:bg-slate-800/50'
          }`}
        >
          <input {...getInputProps()} id="file-upload-input" />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-8 h-8 text-emerald-400" />
              <div className="text-left">
                <div className="text-sm font-medium text-white">{file.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="ml-2 p-1 rounded-full hover:bg-slate-700"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          ) : (
            <>
              <UploadCloud className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-300">
                {isDragActive ? 'Drop it here!' : 'Drag & drop your SRS file here'}
              </p>
              <p className="text-xs text-slate-500 mt-1">or click to browse — PDF, DOCX, TXT supported</p>
            </>
          )}
        </div>
      )}

      {/* Paste text */}
      {tab === 'text' && (
        <textarea
          id="srs-text-input"
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder="Paste your SRS requirements text here…&#10;&#10;REQ-001: The system shall allow users to log in.&#10;REQ-002: The system should be very fast.&#10;..."
          rows={12}
          className="w-full rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm p-4 font-mono placeholder:text-slate-600 resize-none focus:outline-none focus:border-indigo-600 transition-colors"
        />
      )}

      {/* Threshold slider */}
      <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-300">Duplicate Similarity Threshold</label>
          <span className="text-xs font-bold text-indigo-400">{threshold.toFixed(2)}</span>
        </div>
        <input
          id="threshold-slider"
          type="range" min="0.5" max="0.99" step="0.01"
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          className="w-full accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>0.50 (broad)</span><span>0.85 (recommended)</span><span>0.99 (exact)</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-900/30 border border-red-800 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Progress bar */}
      {loading && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Spinner size="sm" /> Running NLP pipeline… {progress}%
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Analyze button */}
      <button
        id="btn-analyze"
        onClick={handleAnalyze}
        disabled={loading || (tab === 'file' ? !file : !pastedText.trim())}
        className="mt-6 w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold transition-colors shadow-lg shadow-indigo-900/30"
      >
        {loading ? 'Analyzing…' : '🔍 Analyze SRS Document'}
      </button>
    </div>
  );
}
