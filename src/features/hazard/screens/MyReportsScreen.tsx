import MyReportsPanel from '../components/MyReportsPanel';
import { useMyReports } from '../hooks/useMyReports';

export default function MyReportsScreen() {
  return <MyReportsPanel model={useMyReports()} />;
}
