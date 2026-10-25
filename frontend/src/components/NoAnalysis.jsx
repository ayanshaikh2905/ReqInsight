import { FlaskConical, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '../context/AnalysisContext';
import { useToast } from '../context/ToastContext';
import { Button } from './Button';
import { EmptyState } from './Card';

/** Shared empty state for every page that needs an analysis to show anything. */
export function NoAnalysis({ icon, what = 'this view' }) {
  const navigate = useNavigate();
  const { loadDemo, loading } = useAnalysis();
  const { toast } = useToast();

  const demo = async () => {
    try {
      await loadDemo();
    } catch (e) {
      toast({ tone: 'bad', title: 'Could not load the demo', description: e.message });
    }
  };

  return (
    <EmptyState
      icon={icon}
      title="Nothing analyzed yet"
      description={`Analyze a Software Requirements Specification to populate ${what}.`}
      action={
        <>
          <Button variant="primary" onClick={() => navigate('/upload')}>
            <UploadCloud className="h-4 w-4" aria-hidden="true" /> Upload a document
          </Button>
          <Button onClick={demo} loading={loading}>
            <FlaskConical className="h-4 w-4" aria-hidden="true" /> Load the demo SRS
          </Button>
        </>
      }
    />
  );
}
