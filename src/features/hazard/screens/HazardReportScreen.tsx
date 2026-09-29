import HazardReportPanel from '../components/HazardReportPanel';
import { useHazardReport, type HazardReportParams } from '../hooks/useHazardReport';

export default function HazardReportScreen(params: HazardReportParams) {
  return <HazardReportPanel model={useHazardReport(params)} />;
}
