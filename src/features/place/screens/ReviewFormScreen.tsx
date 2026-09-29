import ReviewFormPanel from '../components/ReviewFormPanel';
import { useReviewForm } from '../hooks/useReviewForm';

export default function ReviewFormScreen() {
  return <ReviewFormPanel model={useReviewForm()} />;
}
