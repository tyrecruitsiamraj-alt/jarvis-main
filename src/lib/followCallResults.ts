import { CALL_OUTCOME_LABEL, followCallOutcomeText } from '@/lib/callOutcomeTone';
import { CONNECTED_CALL_OUTCOMES, UNREACHED_CALL_OUTCOMES } from '@/lib/callOutcomeBuckets';

/**
 * **ผลการโทรของ AI รายสาย** — สรุปว่าสายนั้นคุยแล้วได้คำตอบว่าอะไรบ้าง
 *
 * 🔴 เจ้าของแจ้ง 3 ก.ย. 2569: *"ยังไม่โชว์สถานะผลการโทรทั้ง 2 สายในหน้าแดชบอร์ด"*
 *
 * เหตุ: 7 กล่องบนแผงเป็น **สองแกน** และไม่มีแกนไหนบอกคำตอบของ AI เลย
 *   · `รอโทร / กำลังโทร / โทรติด / โทรไม่ติด` = สถานะของสาย — "โทรติด" กลืน
 *     *ยืนยันว่าไป* กับ *ไม่ไปแล้ว* ไว้ในเลขเดียวกัน
 *   · `ไป / ไม่ไป` = **ผลปิดงานที่คนกรอก** (`outcome_code`) ⇒ ยังไม่มีใครกดปิดงาน
 *     เลขสองช่องนี้จึงเป็น 0 ทั้งที่ AI คุยจบไปแล้ว 12 สาย (วัดจริง 3 ก.ย.)
 *
 * ⇒ ไฟล์นี้เพิ่ม **บรรทัดสรุปผลจากปาก AI** ไว้ใต้กล่อง โดย
 * 🔴 **ไม่แตะ 7 กล่องเดิม** (เจ้าของสั่งไว้ว่าเจ็ดกล่องคือเจ็ด ห้ามยุบ/สลับเอง)
 *
 * คำบนจอใช้ `followCallOutcomeText()` ที่เดียวกับป๊อปของรอบ — จอสองที่จะได้พูดตรงกัน
 */
export type FollowCallResultRow = {
  cancelled?: boolean;
  call_outcome?: string | null;
};

export type FollowWaitingRow = FollowCallResultRow & {
  call_status?: string | null;
  completed_at?: string | null;
  scheduled_at?: string | null;
};

/** เรียงตามความสำคัญที่คนอ่าน: ตอบแล้วก่อน → ยกหูไม่ได้ทีหลัง */
const RESULT_ORDER: readonly string[] = [
  'confirmed',
  'declined',
  'acknowledged',
  'reschedule_requested',
  ...UNREACHED_CALL_OUTCOMES,
];

export type FollowCallResultCount = {
  code: string;
  label: string;
  count: number;
};

/**
 * นับผลการโทรของสายนั้น — คืนเฉพาะผลที่มีจริง (ผลที่ไม่เกิดขึ้นไม่ต้องขึ้นจอ)
 * ⚠️ รอบที่ยกเลิกไม่นับ — สายที่ถูกตัดทิ้งไม่ใช่ผลการโทร
 */
export function countFollowCallResults(
  rows: readonly FollowCallResultRow[],
): FollowCallResultCount[] {
  const tally = new Map<string, number>();
  for (const r of rows) {
    if (r.cancelled) continue;
    const code = (r.call_outcome ?? '').trim();
    if (!code) continue;
    tally.set(code, (tally.get(code) ?? 0) + 1);
  }

  const known = RESULT_ORDER.filter((c) => (tally.get(c) ?? 0) > 0);
  // ผลที่ยังไม่รู้จัก (Lumos เพิ่มคำใหม่) ต้องยังขึ้นจอ ห้ามหายเงียบ
  const extra = [...tally.keys()].filter((c) => !RESULT_ORDER.includes(c)).sort();

  return [...known, ...extra].map((code) => ({
    code,
    label: code in CALL_OUTCOME_LABEL ? followCallOutcomeText(code) : code,
    count: tally.get(code) ?? 0,
  }));
}

/** จำนวนสายที่ได้คำตอบแล้วในกองนี้ (ไม่นับที่ยกเลิก) */
export function answeredCallCount(rows: readonly FollowCallResultRow[]): number {
  return countFollowCallResults(rows).reduce((sum, r) => sum + r.count, 0);
}

/**
 * บรรทัดสรุปใต้กล่อง — `null` เมื่อยังไม่มีผลเลย (ห้ามขึ้นบรรทัดว่าง หรือขึ้น 0)
 * เช่น `"AI คุยแล้ว 12 สาย — ยืนยันว่าไป 5 · ยกเลิก — ไม่ไปแล้ว 6 · รับสายแล้ว 1"`
 */
export function followCallResultSummary(rows: readonly FollowCallResultRow[]): string | null {
  const items = countFollowCallResults(rows);
  if (items.length === 0) return null;
  const total = items.reduce((sum, r) => sum + r.count, 0);
  const parts = items.map((r) => `${r.label} ${r.count.toLocaleString('th-TH')}`);
  return `AI ได้คำตอบแล้ว ${total.toLocaleString('th-TH')} สาย — ${parts.join(' · ')}`;
}

/** ผลที่ถือว่า "คุยกับคนได้" — ใช้ตรวจว่าควรเน้นบรรทัดสรุปไหม */
export function hasConnectedResult(rows: readonly FollowCallResultRow[]): boolean {
  return countFollowCallResults(rows).some((r) =>
    (CONNECTED_CALL_OUTCOMES as readonly string[]).includes(r.code),
  );
}


/**
 * **สายที่เลยเวลานัดแล้วแต่ยังไม่ถูกยิงออก** — ของค้างที่เงียบที่สุดของหน้านี้
 *
 * 🔴 วัดของจริง 3 ก.ย. 2569: สายที่ 1 นัด 08:20 · บ่ายแล้วยังค้าง `pending` 12 สาย
 * แต่แถบบนแผงขึ้นว่า *"ยังไม่ถึงเวลาที่ตั้งไว้"* ⇒ ต้องแยกให้ออกและพูดตรง ๆ
 *
 * นับเฉพาะที่ **ยังไม่มีผล · ยังไม่ถูกดึงไปโทร (`pending`/ไม่มีสถานะ) · เลยเวลาแล้ว**
 * — `delivered` (AI รับไปแล้ว) ไม่นับ เพราะนั่นคือกำลังโทร ไม่ใช่ค้างที่คิว
 */
export function overdueWaitingCount(
  rows: readonly FollowWaitingRow[],
  now: Date = new Date(),
): number {
  return rows.filter((r) => {
    if (r.cancelled || r.call_outcome || r.completed_at) return false;
    const st = (r.call_status ?? '').trim();
    if (st === 'delivered') return false;
    const at = r.scheduled_at ? Date.parse(r.scheduled_at) : NaN;
    return Number.isFinite(at) && at < now.getTime();
  }).length;
}
