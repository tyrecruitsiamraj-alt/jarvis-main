/**
 * ═══ เตือนบนหน้าติดตามเมื่อระบบเบื้องหลังหยุด (เจ้าของสั่ง 13 ต.ค. 2569 "อะไรที่จะไม่โทร … จะกันให้หมด" · รอบ 3) ═══
 * - ตัวทำงานทุกนาที (ส่งซ้ำ · ตรวจ Lumos นำเข้า · แจ้งเตือนสายที่จะไม่ถูกโทร) ไม่เดินเกิน 5 นาที — เดิมหยุดแล้วไม่มีใครรู้
 * - แท็บส่งคนแทน: ดึงจาก iRecruit ไม่ได้ / ไม่ได้ดึงเกิน 20 นาที (รอบปกติทุก 5 นาที) — เดิมเห็นแค่ตอนกด "ดึงตอนนี้"
 * ไฟล์นี้ pure — เทสต์ `tests/api/followSystemHealth2569-10-13.test.ts`
 */
import type { ReplaceSyncStatus } from './irecruitReplaceSyncApi';

export const FOLLOW_WORKER_STALE_MIN = 5;
export const REPLACE_SYNC_STALE_MIN = 20;

/** 🔴 `Intl` ระดับโมดูลเท่านั้น */
const HHMM = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

const minutesSince = (iso: string | null | undefined, now: Date): number | null => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? (now.getTime() - t) / 60_000 : null;
};

export function followHealthWarnings(
  st: Pick<ReplaceSyncStatus, 'enabled' | 'unavailableReason' | 'lastRun' | 'followWorkerAt'> | null,
  view: 'list' | 'replace' | 'dashboard',
  now: Date = new Date(),
): string[] {
  if (!st) return [];
  const out: string[] = [];
  const workerAge = minutesSince(st.followWorkerAt, now);
  if (workerAge === null || workerAge > FOLLOW_WORKER_STALE_MIN) {
    out.push(
      st.followWorkerAt
        ? `ระบบส่งสายอัตโนมัติหยุดทำงานตั้งแต่ ${HHMM.format(new Date(st.followWorkerAt))} น.`
        : 'ระบบส่งสายอัตโนมัติไม่ทำงาน',
    );
  }
  if (view === 'replace' && st.enabled) {
    const run = st.lastRun;
    const age = minutesSince(run?.at, now);
    if (st.unavailableReason || run?.error) {
      out.push(`ดึงงานจาก iRecruit ไม่ได้${run?.at ? ` (ลองล่าสุด ${HHMM.format(new Date(run.at))} น.)` : ''}`);
    } else if (age === null || age > REPLACE_SYNC_STALE_MIN) {
      out.push(run?.at ? `ไม่ได้ดึงงานจาก iRecruit มาตั้งแต่ ${HHMM.format(new Date(run.at))} น.` : 'ยังไม่ได้ดึงงานจาก iRecruit');
    }
  }
  return out;
}
