import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { FileText, FlaskConical, UploadCloud, X } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { AnalysisProgress } from '../components/AnalysisProgress';
import { Button } from '../components/Button';
import { Card, InlineError, PageHeader } from '../components/Card';
import { Segmented } from '../components/Segmented';

const MAX_BYTES = 25 * 1024 * 1024;

const SAMPLE = `REQ-001: The system shall allow registered users to log in with an email address and password.
REQ-002: The system should respond quickly to user actions.
REQ-003: The system shall lock an account after 5 failed login attempts within 10 minutes.
REQ-004: Passwords must be at least 8 characters long.
REQ-005: Passwords must not exceed 6 characters.`;

const REJECTIONS = {
  'file-invalid-type': 'Only PDF, DOCX and TXT files are supported.',
  'file-too-large': 'That file is larger than 25 MB.',
  'too-many-files': 'Drop one file at a time.',
};

const formatSize = (bytes) => (bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export default function UploadSRS() {
  usePageTitle('Upload SRS');
  const { loading, error, progress, currentDoc, uploadFile, analyzeText, loadDemo } = useAnalysis();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [threshold, setThreshold] = useState(null); // null: use the value saved in Settings
  const [mode, setMode] = useState('file');
  const [text, setText] = useState('');
  const [rejection, setRejection] = useState(null);

  const onDrop = useCallback((accepted, rejected) => {
    if (accepted[0]) {
      setFile(accepted[0]);
      setRejection(null);
    } else if (rejected[0]) {
      setRejection(REJECTIONS[rejected[0].errors[0]?.code] || 'That file could not be used.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: MAX_BYTES,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
  });

  const canSubmit = mode === 'file' ? !!file : text.trim().length > 0;

  const run = async (task) => {
    try {
      await task();
      navigate('/');
    } catch {
      /* the error is surfaced from context below */
    }
  };

  const submit = () =>
    run(() => (mode === 'file' ? uploadFile(file, threshold) : analyzeText(text, 'Pasted SRS')));

  if (loading) {
    return <AnalysisProgress progress={progress} title={currentDoc ? `Analyzing ${currentDoc}` : 'Analyzing your document'} />;
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const ringTone = isDragActive ? 'text-accent' : file ? 'text-ok' : 'text-line';

  return (
    <>
      <PageHeader
        title="Analyze a document"
        subtitle="Upload a Software Requirements Specification or paste its text. ReqInsight extracts each requirement and checks it."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-5 sm:p-6">
          <Segmented
            label="Input method"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'file', label: 'Upload a file' },
              { value: 'text', label: 'Paste text' },
            ]}
          />

          <div className="mt-5">
            {mode === 'file' ? (
              <div
                {...getRootProps()}
                data-active={isDragActive}
                className="dash-march relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-xl p-8 text-center transition-colors hover:bg-raised/60 focus-visible:outline-offset-4"
              >
                <svg className={`pointer-events-none absolute inset-0 h-full w-full transition-colors ${ringTone}`} aria-hidden="true">
                  <rect x="1" y="1" rx="12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }} />
                </svg>
                <input {...getInputProps()} aria-label="SRS file" />
                {file ? (
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-ok" aria-hidden="true" />
                    <div className="text-left">
                      <div className="max-w-[260px] truncate text-sm font-medium text-ink">{file.name}</div>
                      <div className="text-xs text-muted">{formatSize(file.size)}</div>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="ml-2 rounded-full p-1.5 text-muted transition-colors hover:bg-line hover:text-ink"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadCloud className={`h-9 w-9 transition-transform duration-300 ${isDragActive ? '-translate-y-1 text-accent' : 'text-faint'}`} aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-ink">{isDragActive ? 'Release to add this file' : 'Drag a file here, or click to browse'}</p>
                    <p className="mt-1 text-xs text-muted">PDF, DOCX or TXT, up to 25 MB</p>
                  </>
                )}
              </div>
            ) : (
              <div>
                <label htmlFor="srs-text" className="sr-only">SRS text</label>
                <textarea
                  id="srs-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={12}
                  placeholder="Paste requirements here, one per line…"
                  className="w-full resize-y rounded-xl border border-line bg-canvas/60 p-4 font-mono text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus:border-accent"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-faint">
                  <button type="button" onClick={() => setText(SAMPLE)} className="text-accent underline-offset-2 hover:underline">
                    Insert an example
                  </button>
                  <span>{words} words</span>
                </div>
              </div>
            )}
          </div>

          {rejection && <InlineError className="mt-4">{rejection}</InlineError>}
          {error && <InlineError className="mt-4">{error}</InlineError>}

          <Button variant="primary" size="lg" className="mt-6 w-full" disabled={!canSubmit} onClick={submit}>
            Analyze document
          </Button>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="threshold" className="text-sm font-semibold text-ink">Duplicate sensitivity</label>
              <span className="font-mono text-sm tabular-nums text-accent">{(threshold ?? 0.85).toFixed(2)}</span>
            </div>
            <input
              id="threshold"
              type="range"
              min="0.5"
              max="0.99"
              step="0.01"
              value={threshold ?? 0.85}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="mt-4 w-full accent-[rgb(var(--c-accent))]"
            />
            <div className="mt-1 flex justify-between text-xs text-faint">
              <span>Broad</span>
              <span>Exact</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Requirement pairs at or above this similarity are flagged as duplicates. Leave the slider alone to use the value saved in Settings. Pasted text always uses the saved value.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">No document handy?</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              The demo SRS has planted ambiguity, duplicates and a contradiction. It runs offline, with no API key.
            </p>
            <Button className="mt-4 w-full" onClick={() => run(loadDemo)}>
              <FlaskConical className="h-4 w-4" aria-hidden="true" /> Load the demo SRS
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
