/**
 * ═══ กล่องใบขอของหน้าหลัก → ไล่ 12 เดือน → รายวัน → BU → เหตุผล (เจ้าของ 23 พ.ย. 2569 ข้อ 2) ═══
 * > "ทุกกล่องกดแล้วต้องเห็นหมด" (22 พ.ย. 2569) · แผงเดียวกับกล่องผู้สมัคร (`TimeDrillSheet`) แต่ชุดข้อมูลเป็นใบขอ
 *
 * ตัวตัดสินเดียวกับสมการใบขอบนหน้าหลัก (`requestFlowRole`) ⇒ แท่งของเดือน = เลขบนกล่องเมื่อเลือกช่วงเป็นเดือนนั้น
 *  - ขอใหม่ = วันคีย์ใบ (`keyYmd`) · เหตุผล = ชนิดใบ (ฉุกเฉิน/ย้อนหลัง · ฉุกเฉิน · ล่วงหน้า)
 *  - ปิดครบ / ยกเลิก = เดือนที่ `requestFlowRole` ของเดือนนั้นตอบ closed / cancelledReq · วัน = วันแรกในเดือนที่ใบหมดอัตรา
 *    เหตุผลปิดครบ = ทันวันที่ต้องการไหม (เทียบวันปิดกับวันที่ต้องการ) · เหตุผลยกเลิก = เหตุผลหยุดใบจาก ERP (`stopReason`)
 * ใบหนึ่งอยู่ได้หลายกล่อง (ขอใหม่ มี.ค. · ปิดครบ พ.ค.) ⇒ หนึ่งเหตุการณ์ = หนึ่งแถวของ items (ช่องกล่องอื่น = -1)
 * ไฟล์นี้ pure — เทสต์ `tests/api/homeRequestDrill2569-11-23.test.ts`
 */
import type { ToneKey } from './designTokens';
import { drillMonthList, type DrillBox, type DrillPayload, type DrillReason } from './homeDrill';
import { REQUEST_LEAD_KIND_LABEL, REQUEST_LEAD_KIND_TONE, requestLeadKindFromYmd, type RequestLeadKind } from './requestLeadKind';
import { ledgerJobIdOf, requestFlowRole, type LedgerRequest } from './requestPenaltyLedger';

const DAY_MS = 86_400_000;
const dayNo = (ymd: string) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / DAY_MS);
const lastOfMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

const LEAD_ORDER: RequestLeadKind[] = ['retroactive', 'urgent', 'advance'];

/** ปิดครบทันวันที่ลูกค้าต้องการไหม — เทียบวันปิดกับวันที่ต้องการ (ไม่มีวันที่ต้องการ = ช่องของตัวเอง ไม่เดา) */
export const CLOSED_TIMING: ReadonlyArray<{ key: string; label: string; tone: ToneKey }> = [
  { key: 'onTime', label: 'ทันวันที่ต้องการ', tone: 'success' },
  { key: 'late7', label: 'ช้า 1–7 วัน', tone: 'warn' },
  { key: 'late30', label: 'ช้า 8–30 วัน', tone: 'orange' },
  { key: 'late30plus', label: 'ช้าเกิน 30 วัน', tone: 'danger' },
  { key: 'noNeed', label: 'ไม่มีวันที่ต้องการ', tone: 'neutral' },
];
export function closedTimingOf(needYmd: string | null, closedYmd: string): string {
  if (!needYmd) return 'noNeed';
  const late = dayNo(closedYmd) - dayNo(needYmd);
  if (late <= 0) return 'onTime';
  if (late <= 7) return 'late7';
  if (late <= 30) return 'late30';
  return 'late30plus';
}
export const NO_STOP_REASON = 'ไม่ได้กรอกเหตุผล';

/** วันที่ใบหมดอัตราในเดือนนั้น — วันที่ตำแหน่งที่เปิดเปลี่ยนมีแค่ วันคีย์ · วันคนเริ่มงาน · วันใบจบ (แบบเดียวกับ `requestFlowDays`) */
function endDayIn(r: LedgerRequest, from: string, to: string): string {
  const days = new Set<string>();
  if (r.keyYmd >= from && r.keyYmd <= to) days.add(r.keyYmd);
  for (const [d] of r.starts) if (d >= from && d <= to) days.add(d);
  if (r.endYmd != null && r.endYmd >= from && r.endYmd <= to) days.add(r.endYmd);
  for (const d of [...days].sort()) {
    const x = requestFlowRole(r, d, d);
    if (x.closed || x.cancelledReq) return d;
  }
  // ไม่เจอวันที่เปลี่ยน (ไม่ควรเกิด) — ใส่วันสุดท้ายที่มีความเคลื่อนไหว ไม่ทิ้งใบ
  return [...days].sort().pop() ?? to;
}

/**
 * ใบขอของสมุด → payload ชุดใบขอ · `buOf` = BU รหัสสั้น (LBD · LM …) · ใบนอก 12 เดือนไม่นับ
 * เดือนสุดท้ายนับถึง `to` (วันนี้) — ตรงกับกล่องหน้าหลักช่วง "เดือนนี้"
 */
export function buildRequestDrillPayload(requests: readonly LedgerRequest[], from: string, to: string, buOf: (r: LedgerRequest) => string): DrillPayload {
  const bus: string[] = [];
  const buIndex = new Map<string, number>();
  const stops: DrillReason[] = [];
  const stopIndex = new Map<string, number>();
  const items: number[][] = [];
  const ids: string[] = [];
  const labels: string[] = [];
  const base = dayNo(from);
  const months = drillMonthList(from, to);
  const timingIndex = new Map(CLOSED_TIMING.map((t, i) => [t.key, i]));
  const push = (r: LedgerRequest, day: string, box: 0 | 1 | 2, reason: number) => {
    const bu = (buOf(r) || '').trim().toUpperCase();
    let b = buIndex.get(bu);
    if (b === undefined) {
      b = bus.length;
      buIndex.set(bu, b);
      bus.push(bu);
    }
    const row = [dayNo(day) - base, b, -1, -1, -1];
    row[2 + box] = reason;
    items.push(row);
    ids.push(ledgerJobIdOf(r));
    labels.push([r.requestNo, r.unit].filter(Boolean).join(' · '));
  };
  for (const r of requests) {
    if (r.keyYmd >= from && r.keyYmd <= to) push(r, r.keyYmd, 0, LEAD_ORDER.indexOf(requestLeadKindFromYmd(r.keyYmd, r.needYmd)));
    for (const month of months) {
      const mFrom = `${month}-01`;
      const last = lastOfMonth(month);
      const mTo = last > to ? to : last;
      if (r.keyYmd > mTo || (r.endYmd != null && r.endYmd < mFrom && r.starts.every(([d]) => d < mFrom))) continue;
      const role = requestFlowRole(r, mFrom, mTo);
      if (!role.closed && !role.cancelledReq) continue;
      const day = endDayIn(r, mFrom, mTo);
      if (role.closed) {
        push(r, day, 1, timingIndex.get(closedTimingOf(r.needYmd, day)) ?? 0);
      } else {
        const reason = (r.stopReason ?? '').trim() || NO_STOP_REASON;
        let i = stopIndex.get(reason);
        if (i === undefined) {
          i = stops.length;
          stopIndex.set(reason, i);
          stops.push({ key: `stop:${reason}`, label: reason, tone: reason === NO_STOP_REASON ? 'neutral' : 'danger' });
        }
        push(r, day, 2, i);
      }
    }
  }
  const boxes: DrillBox[] = [
    { key: 'reqNew', title: 'ขอใหม่', unit: 'ใบ', reasons: LEAD_ORDER.map((k) => ({ key: k, label: REQUEST_LEAD_KIND_LABEL[k], tone: REQUEST_LEAD_KIND_TONE[k] })) },
    { key: 'reqClosed', title: 'ปิดครบ', unit: 'ใบ', reasons: CLOSED_TIMING.map((t) => ({ ...t })) },
    { key: 'reqCancelled', title: 'ยกเลิก', unit: 'ใบ', reasons: stops },
  ];
  return { version: 1, from, to, bus, boxes, items, ids, labels };
}
