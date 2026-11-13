import React from 'react';
import { LoaderCircle, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { cancelJobPostingRequest, fetchSoIssues, startJobPostingRequestWithItem, type JobPostingRequest } from '@/lib/jobPostingRequestsApi';
import { soStartText, type SoStartView } from '@/lib/soScraping';

/**
 * ═══ ใบที่ค้าง (pending) — บอกเหตุ + ทางไปต่อ (เจ้าของ 4 พ.ย. 2569 ฉบับ 9 ข้อ 1) ═══
 * เดิมขึ้น "รอให้เสร็จก่อนถึงสั่งใหม่ได้" แล้วกดอะไรไม่ได้เลย (ใบที่ So Scraping เริ่มไม่ได้ เช่น บัญชีถูกพัก ค้างตลอด)
 * - เหตุจาก So Scraping (`issues`) เป็นคำ · อ่านไม่ได้ = บอกว่ายังไม่เริ่ม
 * - "ส่งให้ So Scraping อีกครั้ง" = start เดิม (แก้ที่ So Scraping แล้ว)
 * - "ยกเลิกใบนี้แล้วสั่งใหม่" = ยกเลิกได้เฉพาะตอนยังค้าง (So Scraping เริ่มแล้ว = บอกว่ายกเลิกไม่ได้) → หน้าแม่เปิดฟอร์มสั่งต่อ
 */
export default function SoStuckPanel({
  order,
  onCancelled,
  onItem,
}: {
  order: JobPostingRequest;
  onCancelled: (cancelled: JobPostingRequest) => void;
  /** แถวใบล่าสุดจากฐานหลัง "ส่งอีกครั้ง" (13 พ.ย. 2569) — เริ่มแล้ว = หน้าแม่แทนแถวเดิม กล่องค้างหายเอง */
  onItem?: (item: JobPostingRequest) => void;
}) {
  const type = order.request_type === 'scraping' ? 'scraping' : 'content';
  const [issues, setIssues] = React.useState<string[] | null>(null);
  const [busy, setBusy] = React.useState<'retry' | 'cancel' | null>(null);
  const [start, setStart] = React.useState<SoStartView | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setIssues(null);
    const rq = (order.request_no ?? '').trim();
    if (!rq) {
      setIssues([]);
      return;
    }
    void fetchSoIssues(rq, type).then((list) => alive && setIssues(list));
    return () => {
      alive = false;
    };
  }, [order.id, order.request_no, type]);

  const retry = async () => {
    setBusy('retry');
    setError(null);
    try {
      const r = await startJobPostingRequestWithItem(order.id);
      setStart(r.start);
      if (r.item) onItem?.(r.item);
    } catch (e) {
      setStart({ state: 'error', message: e instanceof Error ? e.message : 'ส่งไม่สำเร็จ' });
    } finally {
      setBusy(null);
    }
  };
  const cancel = async () => {
    setBusy('cancel');
    setError(null);
    try {
      onCancelled(await cancelJobPostingRequest(order.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };
  const startView = soStartText(start);

  return (
    <div className={cn('space-y-2 rounded-xl border px-3 py-2', TONE.warn.soft)} data-testid="so-stuck">
      <p className="text-sm font-medium text-foreground">{type === 'scraping' ? 'คำขอ Scrap ค้างอยู่' : 'คำสั่งโพสต์ค้างอยู่'}</p>
      {issues === null ? (
        <p className={cn('text-sm', DASH.muted)}>กำลังดูเหตุจาก So Scraping…</p>
      ) : issues.length > 0 ? (
        <ul className={cn('space-y-0.5 text-sm', TONE.warn.value)} data-testid="so-stuck-issues">
          {issues.map((t) => (
            <li key={t}>ยังเริ่มไม่ได้: {t}</li>
          ))}
        </ul>
      ) : (
        <p className={cn('text-sm', TONE.warn.value)}>So Scraping ยังไม่เริ่มงานใบนี้</p>
      )}
      {startView ? <p className={cn('text-sm', TONE[startView.tone].value)}>{startView.text}</p> : null}
      {error ? (
        <p role="alert" className={cn('text-sm', TONE.danger.value)} data-testid="so-stuck-error">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void retry()} data-testid="so-stuck-retry">
          {busy === 'retry' ? <LoaderCircle className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
          ส่งให้ So Scraping อีกครั้ง
        </Button>
        <Button type="button" size="sm" disabled={busy !== null} onClick={() => void cancel()} data-testid="so-stuck-cancel">
          {busy === 'cancel' ? <LoaderCircle className="animate-spin" aria-hidden /> : <X aria-hidden />}
          ยกเลิกใบนี้แล้วสั่งใหม่
        </Button>
      </div>
    </div>
  );
}
