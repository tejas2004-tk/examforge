import { useParams } from 'react-router-dom';
import { ResultDetail } from '../../components/ResultDetail.jsx';

export function AdminResultDetailPage() {
  const { attemptId } = useParams();
  return <ResultDetail attemptId={attemptId} onGrade={true} />;
}
