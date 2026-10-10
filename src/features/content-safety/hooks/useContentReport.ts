import { useRef, useState } from 'react';
import { getAppLanguage, useAppTranslation } from '@/shared/i18n';
import { submitContentReport } from '../api/contentSafetyApi';
import { validReport, type ContentTarget, type ReportReason, type ReportReceipt } from '../domain/types';
import { captureContentOwner } from '../store/contentSafetyStore';

export function useContentReport(target: ContentTarget) {
  const { t } = useAppTranslation();
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReportReceipt | null>(null);
  const busy = useRef(false);
  const submit = async () => {
    if (busy.current || receipt || !reason || !validReport(reason, details)) return;
    const current = captureContentOwner();
    if (!current()) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitContentReport({ ...target, reason, details: details.trim(), language: getAppLanguage() });
      if (current()) setReceipt(result);
    } catch {
      if (current()) setError(t('contentActionFailed'));
    } finally {
      busy.current = false;
      if (current()) setSubmitting(false);
    }
  };
  return { reason, setReason, details, setDetails, submitting, error, receipt, valid: validReport(reason, details), submit: () => void submit() };
}
export type ContentReportModel = ReturnType<typeof useContentReport>;
