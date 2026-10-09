import MyReportDetailPanel from '../components/MyReportDetailPanel';
import { useMyReportDetail } from '../hooks/useMyReportDetail';

export default function MyReportDetailScreen({ id }: { id: string | undefined }) {
  return <MyReportDetailPanel model={useMyReportDetail(id)} />;
}
