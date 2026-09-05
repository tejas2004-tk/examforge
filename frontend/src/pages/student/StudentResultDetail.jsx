import { useParams } from 'react-router-dom';
import { ResultDetail } from '../../components/ResultDetail.jsx';

export function StudentResultDetail() {
  const { attemptId } = useParams();
  return <ResultDetail attemptId={attemptId} />;
}
