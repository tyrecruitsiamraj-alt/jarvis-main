/**
 * ═══ สมุดบัญชีติดตาม — ทุกรายการเรียงตามเวลา แบบสมุดบัญชีธนาคาร (เจ้าของ 7 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"ลองนึกภาพอะธนาคาร หุ้น ไรเงี้ย · มันต้องละเอียดทุก Activity"* → Choice "แบบสมุดบัญชี" · "หน้ารวมทุกรายการ" · "บนหน้าหลัก"
 * หน่วย = รายชื่อ (หนึ่งแถวติดตาม = หนึ่งสาย · หน่วยเดียวกับการ์ดหน้าหลัก)
 *
 * ยอดคงเหลือ = สายที่ยังไม่จบ ณ เวลานั้น
 *   เข้า (+1) = เพิ่มเข้าระบบ (`created_at`)
 *   ออก (−1) = ได้ผล (เวลาที่ผลเข้า: คนลงผล `staff_called_at` / AI `first_result_at`) หรือ ยกเลิก (`cancelled_at`)
 *   ไม่กระทบยอด = ส่งให้ AI · แก้ไข · iRecruit แก้
 * ⇒ ยกมา + เพิ่ม − ได้ผล − ยกเลิก = คงเหลือ **ลงตัวเสมอโดยโครงสร้าง** (แต่ละสายเข้าครั้งเดียว ออกได้ครั้งเดียว · ออกก่อนเข้า = ปัดเป็นเวลาเข้า)
 * จบแบบไหน = หมวดปัจจุบันของสาย (`categorizeFollowRows` ตัวเดียวกับการ์ด/แผงผลโทร) — รอโทร/เลยเวลา/ไม่ได้ส่ง = ยังไม่จบ
 * ไฟล์นี้ pure — เทสต์ `tests/api/followLedger.test.ts`
 */
import type { FollowJourneyResult, FollowJourneyTeam } from '@/lib/followJourney';

/** หนึ่งสาย (server ส่งมาแบบเบา ไม่มีเบอร์) */
export type LedgerCall = {
  id: string;
  name: string;
  unit: string | null;
  bu: string | null;
  team: FollowJourneyTeam;
  caller: 'ai' | 'manual';
  /** เวลานัดโทร ISO */
  scheduledAt: string;
  createdAt: string;
  /** ใครเพิ่ม (อีเมล / ชื่อ / iRecruit) */
  createdBy: string | null;
  /** ส่งให้ Lumos สำเร็จเมื่อไหร่ (สาย AI) */
  sentAt: string | null;
  /** จบเมื่อไหร่ แบบไหน — null = ยังไม่จบ */
  exit: { kind: 'result' | 'cancel'; at: string; by: string | null; result: FollowJourneyResult } | null;
};

/** รายการที่ไม่กระทบยอด (จาก audit) */
export type LedgerNote = {
  callId: string;
  at: string;
  kind: 'edit' | 'reschedule' | 'reopen' | 'staffClear' | 'irecruitEdit';
  by: string | null;
};

export type LedgerKind = 'add' | 'send' | 'result' | 'cancel' | LedgerNote['kind'];

export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = {
  add: 'เพิ่มเข้าระบบ',
  send: 'ส่งให้ AI โทร',
  result: 'ได้ผล',
  cancel: 'ยกเลิก',
  edit: 'แก้ไข',
  reschedule: 'แก้ตาราง',
  reopen: 'ย้อนสถานะ',
  staffClear: 'ล้างผลที่ลง',
  irecruitEdit: 'iRecruit แก้',
};

export type LedgerLine = {
  key: string;
  at: string;
  kind: LedgerKind;
  /** +1 เข้า · −1 ออก · 0 ไม่กระทบยอด */
  delta: -1 | 0 | 1;
  call: LedgerCall;
  by: string | null;
  result: FollowJourneyResult | null;
  /** ยอดคงเหลือหลังรายการนี้ */
  balance: number;
};

export type Ledger = {
  opening: number;
  added: number;
  results: number;
  cancelled: number;
  closing: number;
  /** ใหม่สุดก่อน */
  lines: LedgerLine[];
};

const t = (iso: string) => Date.parse(iso);

/** เวลาออกจริงที่ใช้คิด — ไม่ก่อนเวลาเข้า (ข้อมูลเก่าบางแถวลงผลก่อนเวลาสร้าง) */
export function exitTime(c: LedgerCall): number | null {
  if (!c.exit) return null;
  return Math.max(t(c.exit.at), t(c.createdAt));
}

/** สายนี้ยังไม่จบ ณ เวลา `at` ไหม (เข้าแล้ว และยังไม่ออก) */
export function openAt(c: LedgerCall, at: number): boolean {
  const out = exitTime(c);
  return t(c.createdAt) < at && (out === null || out >= at);
}

/** ลำดับในเวลาเดียวกัน: เข้าก่อน แล้วรายการกลาง แล้วออก (ยอดไม่ติดลบชั่วคราว) */
const ORDER: Record<LedgerKind, number> = {
  add: 0,
  send: 1,
  edit: 2,
  reschedule: 2,
  reopen: 2,
  staffClear: 2,
  irecruitEdit: 2,
  result: 3,
  cancel: 3,
};

/**
 * สมุดบัญชีของช่วง [start, end) — null = ไม่จำกัด · `calls` ต้องครบทุกสายที่เข้าก่อน `end`
 * (สายที่จบก่อน `start` ส่งมาก็ได้ ไม่นับ)
 */
export function buildLedger(
  calls: readonly LedgerCall[],
  notes: readonly LedgerNote[],
  start: Date | null,
  end: Date | null,
): Ledger {
  const s = start ? start.getTime() : -Infinity;
  const e = end ? end.getTime() : Infinity;
  const inWin = (x: number) => x >= s && x < e;
  const byId = new Map(calls.map((c) => [c.id, c]));

  const opening = start ? calls.filter((c) => openAt(c, s)).length : 0;
  const raw: Omit<LedgerLine, 'balance'>[] = [];
  for (const c of calls) {
    if (inWin(t(c.createdAt))) {
      raw.push({ key: `${c.id}:add`, at: c.createdAt, kind: 'add', delta: 1, call: c, by: c.createdBy, result: null });
    }
    if (c.sentAt && inWin(t(c.sentAt))) {
      raw.push({ key: `${c.id}:send`, at: c.sentAt, kind: 'send', delta: 0, call: c, by: 'ระบบ', result: null });
    }
    const out = exitTime(c);
    if (c.exit && out !== null && inWin(out)) {
      raw.push({
        key: `${c.id}:${c.exit.kind}`,
        at: new Date(out).toISOString(),
        kind: c.exit.kind,
        delta: -1,
        call: c,
        by: c.exit.by,
        result: c.exit.kind === 'result' ? c.exit.result : null,
      });
    }
  }
  notes.forEach((n, i) => {
    const c = byId.get(n.callId);
    if (!c || !inWin(t(n.at))) return;
    raw.push({ key: `${n.callId}:${n.kind}:${i}`, at: n.at, kind: n.kind, delta: 0, call: c, by: n.by, result: null });
  });

  raw.sort((a, b) => t(a.at) - t(b.at) || ORDER[a.kind] - ORDER[b.kind] || a.key.localeCompare(b.key));
  let balance = opening;
  const lines: LedgerLine[] = raw.map((l) => {
    balance += l.delta;
    return { ...l, balance };
  });
  const added = lines.filter((l) => l.kind === 'add').length;
  const results = lines.filter((l) => l.kind === 'result').length;
  const cancelled = lines.filter((l) => l.kind === 'cancel').length;
  const closing = end ? calls.filter((c) => openAt(c, e)).length : calls.filter((c) => !c.exit).length;
  return { opening, added, results, cancelled, closing, lines: lines.reverse() };
}

/** ยอดลงตัวไหม — ยกมา + เพิ่ม − ได้ผล − ยกเลิก = คงเหลือ */
export const ledgerBalances = (l: Ledger) => l.opening + l.added - l.results - l.cancelled === l.closing;

/** คำตอบของ `/api/home-ai-share?ledger=follow` — สายที่เกี่ยวกับช่วง + รายการจาก audit · หน้าคิดยอดเอง (กรองแท็บแล้วยอดยังลงตัว) */
export type FollowLedgerResponse = {
  generated_at: string;
  from: string | null;
  to: string | null;
  bu: string | null;
  calls: LedgerCall[];
  notes: LedgerNote[];
  error: string | null;
};
