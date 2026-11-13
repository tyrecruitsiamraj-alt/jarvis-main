import React from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { startJobPostingRequestWithItem, type JobPostingRequest } from '@/lib/jobPostingRequestsApi';
import { soStartText, type SoStartView } from '@/lib/soScraping';

/**
 * ผลเริ่มงานที่ So Scraping หลังกดส่ง (เอกสารรอบ 3 · 26 ต.ค. 2569) — ใช้ทั้ง Autopost และขอ Scrap
 * ติดปัญหา (422/ล่ม) = บอกเหตุผลจาก So Scraping + ปุ่ม "เริ่มงานอีกครั้ง" · ยังไม่ใส่ key = ไม่ขึ้นอะไร
 */
export default function SoStartLine({
  requestId,
  initial,
  onItem,
}: {
  requestId: string;
  initial: SoStartView | null | undefined;
  /** แถวใบล่าสุดจากฐานหลังกด "เริ่มงานอีกครั้ง" (13 พ.ย. 2569) — หน้าแม่ใช้แทนแถวเดิม ป้าย/กล่องค้างจะได้ตรงฐาน */
  onItem?: (item: JobPostingRequest) => void;
}) {
  const [result, setResult] = React.useState<SoStartView | null | undefined>(initial);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setResult(initial), [initial]);
  const view = soStartText(result);
  if (!view) return null;

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await startJobPostingRequestWithItem(requestId);
      setResult(r.start);
      if (r.item) onItem?.(r.item);
    } catch (e) {
      setResult({ state: 'error', message: e instanceof Error ? e.message : 'เริ่มงานไม่สำเร็จ' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="so-start">
      <p className={cn('text-sm', TONE[view.tone].value)} role={view.tone === 'danger' ? 'alert' : undefined}>
        {view.text}
      </p>
      {view.canRetry ? (
        <Button type="button" size="xs" variant="outline" disabled={busy} onClick={() => void retry()} data-testid="so-start-retry">
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          เริ่มงานอีกครั้ง
        </Button>
      ) : null}
    </div>
  );
}
