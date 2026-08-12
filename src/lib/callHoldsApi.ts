import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';

/**
 * "รับไปโทรเอง" — ล็อกสิทธิ์โทรผู้สมัคร กันเจ้าหน้าที่โทรชนกัน และกัน AI โทรทับ
 * ล็อกผูกกับเบอร์ (ฝั่ง server normalize เป็น E.164 เอง) · อายุ 1 วัน
 * ดู api/_lib/candidateCallHolds.ts
 */
/** 'application' = ใบสมัครจากบอร์ดรับสมัคร — เพิ่ม 11 ส.ค. 2569 รอบหก (ดึงเก็บไปโทรจากแถวรายชื่อ) */
export type CallHoldSource = 'board' | 'irecruit' | 'application';

/**
 * ป้ายที่มาของงานโทร — **แหล่งเดียวของทั้งระบบ** ห้าม ternary สองทางในไฟล์หน้า
 * (บั๊กเดิม: หน้าโทรเขียน `source === 'board' ? 'คนของเรา' : 'iRecruit'`
 * ซึ่งจะโชว์ผิดทันทีที่มี source ที่สาม)
 */
export const CALL_HOLD_SOURCE_LABEL: Record<CallHoldSource, string> = {
  board: 'คนของเรา',
  irecruit: 'iRecruit',
  application: 'ใบสมัคร',
};

/** ศัพท์เดียวกับ Lumos outcome — funnel จึงนับ "ผลจากคน" รวมกับ "ผลจาก AI" ได้ */
export type CallResultOutcome =
  | 'confirmed'
  | 'declined'
  | 'reschedule_requested'
  | 'no_answer'
  | 'wrong_person';

/** ปฏิเสธแบบไหน — job = ไม่เอางานนี้ (AI เสนองานอื่นต่อได้) · all = ไม่หางานแล้ว (พักเบอร์) */
export type CallResultScope = 'job' | 'all';

/** ล็อกที่ server ส่งกลับ — **ไม่มีเบอร์** เพื่อไม่ให้ล็อกของแผนกอื่นรั่วเบอร์ออกมา */
export type CallHold = {
  id: string;
  candidateRef: string;
  source: CallHoldSource;
  candidateName: string | null;
  jobId: string;
  requestNo: string | null;
  heldByName: string | null;
  heldAt: string;
  expiresAt: string;
  /** เราเป็นคนถือหรือเปล่า — ใช้ตัดสินว่าโชว์ปุ่มกดผล หรือโชว์ 🔒 */
  mine: boolean;
};

/** ลำดับที่ใช้โชว์ผลโทรของ "คน" ทุกหน้า — เรียงตามความสำคัญที่ต้องเห็นก่อน */
export const CALL_RESULT_OUTCOMES: CallResultOutcome[] = [
  'confirmed',
  'declined',
  'reschedule_requested',
  'no_answer',
  'wrong_person',
];

export const CALL_RESULT_LABEL: Record<CallResultOutcome, string> = {
  confirmed: 'สนใจ',
  declined: 'ไม่สนใจ',
  reschedule_requested: 'นัดโทรใหม่',
  no_answer: 'ไม่รับสาย',
  wrong_person: 'เบอร์ผิด',
};

/** ปลายทางของผลแต่ละแบบ — โชว์ให้เจ้าหน้าที่รู้ว่ากดแล้วงานวิ่งไปไหน */
export const CALL_RESULT_DESTINATION: Record<CallResultOutcome, string> = {
  confirmed: 'เข้าเส้นจองตัว — ใบอื่นที่เขาแมทจะขึ้น “ติดใบขอ”',
  declined: 'คืนให้ AI เสนองานอื่นต่อ',
  reschedule_requested: 'นัดโทรใหม่ตามเวลาที่ผู้สมัครบอก',
  no_answer: 'เข้าคิวโทรซ้ำ — AI รับช่วงต่อได้',
  wrong_person: 'ตัดจบ + ติดธงข้อมูลเบอร์ผิดให้คนแก้',
};

/**
 * ล็อกที่ยังถืออยู่ของเบอร์ชุดนี้ — คืน map candidateRef → ล็อก
 * ล้มเหลวคืน map ว่าง (ข้อมูลเสริมของการ์ด ไม่ควรทำให้หน้า Matching พัง)
 */
export async function fetchCallHoldsByPhones(
  phones: Array<string | null | undefined>,
): Promise<Map<string, CallHold>> {
  const list = [...new Set(phones.map((p) => (p || '').trim()).filter(Boolean))];
  const out = new Map<string, CallHold>();
  if (list.length === 0) return out;
  for (let i = 0; i < list.length; i += 300) {
    try {
      const params = new URLSearchParams({ phones: list.slice(i, i + 300).join(',') });
      const r = await apiFetch(`/api/matching/call-holds?${params}`);
      if (!r.ok) continue;
      const data = await readJsonSafe<{ holds?: CallHold[] }>(r);
      for (const h of data?.holds ?? []) out.set(h.candidateRef, h);
    } catch {
      /* ก้อนนี้พลาดก็ข้าม — การ์ดจะแสดงเป็น "ว่าง" ซึ่ง server ยังกันชนให้อยู่ดี */
    }
  }
  return out;
}

/** งานโทรที่ฉันถืออยู่ — แถบหัวหน้า + หน้า "โทรของฉัน" */
export async function fetchMyCallHolds(): Promise<CallHold[]> {
  try {
    const r = await apiFetch('/api/matching/call-holds?mine=1');
    if (!r.ok) return [];
    const data = await readJsonSafe<{ holds?: CallHold[] }>(r);
    return data?.holds ?? [];
  } catch {
    return [];
  }
}

/** สรุปผลโทร "ที่คนบันทึก" ของวันนี้ — ต่อกับยอดของ AI เป็น funnel เดียวในหน้าเว็บ */
export type CallResultTally = {
  byOutcome: Record<CallResultOutcome, number>;
  declinedByScope: { job: number; all: number };
  total: number;
};

export const EMPTY_TALLY: CallResultTally = {
  byOutcome: {
    confirmed: 0,
    declined: 0,
    reschedule_requested: 0,
    no_answer: 0,
    wrong_person: 0,
  },
  declinedByScope: { job: 0, all: 0 },
  total: 0,
};

/** งานโทรที่ฉันถืออยู่ + ยอดผลของฉันวันนี้ — หน้า "โทรของฉัน" */
export async function fetchMyCallQueue(): Promise<{ holds: CallHold[]; tally: CallResultTally }> {
  try {
    const r = await apiFetch('/api/matching/call-holds?mine=1');
    if (!r.ok) return { holds: [], tally: EMPTY_TALLY };
    const data = await readJsonSafe<{ holds?: CallHold[]; tally?: CallResultTally | null }>(r);
    return { holds: data?.holds ?? [], tally: data?.tally ?? EMPTY_TALLY };
  } catch {
    return { holds: [], tally: EMPTY_TALLY };
  }
}

/** ล็อกของทั้งทีม + ยอดวันนี้ของทีม — บอร์ดหัวหน้า (403 ถ้าไม่ใช่หัวหน้า) */
export async function fetchTeamCallQueue(): Promise<{
  holds: CallHold[];
  tally: CallResultTally;
  forbidden: boolean;
}> {
  try {
    const r = await apiFetch('/api/matching/call-holds?team=1');
    if (r.status === 403) return { holds: [], tally: EMPTY_TALLY, forbidden: true };
    if (!r.ok) return { holds: [], tally: EMPTY_TALLY, forbidden: false };
    const data = await readJsonSafe<{ holds?: CallHold[]; tally?: CallResultTally | null }>(r);
    return { holds: data?.holds ?? [], tally: data?.tally ?? EMPTY_TALLY, forbidden: false };
  } catch {
    return { holds: [], tally: EMPTY_TALLY, forbidden: false };
  }
}

/** โอนงานโทรให้คนอื่น (หัวหน้า) */
export async function transferCallHold(
  holdId: string,
  toUserId: string,
  toName?: string | null,
): Promise<void> {
  const r = await apiFetch('/api/matching/call-holds', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ holdId, transferToUserId: toUserId, transferToName: toName ?? null }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โอนงานโทรไม่สำเร็จ'));
}

/** เทกองของคนคนหนึ่งทั้งหมด (หัวหน้า) — คืนจำนวนที่ปล่อย */
export async function dumpCallHoldsForUser(
  userId: string,
  reason: 'manual' | 'to_ai',
): Promise<number> {
  const params = new URLSearchParams({ dumpUserId: userId, reason });
  const r = await apiFetch(`/api/matching/call-holds?${params}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'เทกองไม่สำเร็จ'));
  const data = await readJsonSafe<{ released?: number }>(r);
  return data?.released ?? 0;
}

export type AcquireCallHoldInput = {
  phone: string;
  source: CallHoldSource;
  candidateRef: string;
  candidateName?: string | null;
  jobId: string;
  requestNo?: string | null;
};

/**
 * ผลการกดรับงานโทร — เป็น object แบน (ไม่ใช่ discriminated union) โดยตั้งใจ
 * เพราะจุดเรียกใช้อยู่ใน callback ของ setState หลายชั้น ซึ่ง narrowing ของ union
 * ไม่ข้ามเข้าไปให้ ทำให้ต้อง cast ทุกที่ · แบบแบนอ่านง่ายกว่าและไม่ต้อง cast
 *   ok=true  → hold มีค่าเสมอ
 *   ok=false → message มีค่าเสมอ · heldBy มีเมื่อชนกับคนอื่น (409)
 */
export type AcquireCallHoldResult = {
  ok: boolean;
  hold: CallHold | null;
  message: string | null;
  /** ใครถืออยู่ — มีเฉพาะกรณีชนกัน ใช้อัปเดตการ์ดทันทีโดยไม่ต้องรีเฟรช */
  heldBy: CallHold | null;
};

/**
 * รับไปโทรเอง — คนแรกชนะ
 * 409 = มีคนถือแล้ว (คืนข้อมูลว่าใครถือ ให้หน้าเว็บอัปเดตการ์ดได้ทันทีไม่ต้องรีเฟรช)
 */
export async function acquireCallHold(
  input: AcquireCallHoldInput,
): Promise<AcquireCallHoldResult> {
  const r = await apiFetch('/api/matching/call-holds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (r.ok) {
    const data = await readJsonSafe<{ hold: CallHold }>(r);
    return { ok: true, hold: (data as { hold: CallHold }).hold, message: null, heldBy: null };
  }
  let heldBy: CallHold | null = null;
  let message = 'รับงานโทรไม่สำเร็จ';
  try {
    const data = (await r.json()) as { message?: string; hold?: CallHold };
    if (data?.message) message = data.message;
    if (data?.hold) heldBy = data.hold;
  } catch {
    /* ใช้ข้อความเริ่มต้น */
  }
  return { ok: false, hold: null, message, heldBy };
}

export type RecordCallResultInput = {
  holdId: string;
  outcome: CallResultOutcome;
  /** บังคับใส่เมื่อ outcome = declined — ไม่ใส่ถือเป็น 'job' */
  scope?: CallResultScope;
  note?: string | null;
  /** ข้อมูลต่อท้ายตามชนิดผล เช่น { callbackAt } · { agreedSalary } · { newPhone } */
  detail?: Record<string, unknown>;
};

/** บันทึกผลโทร — บันทึกแล้วล็อกถูกปล่อยอัตโนมัติ (ผลจบ = ไม่ต้องถือต่อ) */
export async function recordCallResult(input: RecordCallResultInput): Promise<CallHold> {
  const r = await apiFetch('/api/matching/call-holds', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกผลโทรไม่สำเร็จ'));
  const data = await readJsonSafe<{ hold: CallHold }>(r);
  return (data as { hold: CallHold }).hold;
}

/** คืนงานโดยไม่บันทึกผล — 'to_ai' = ส่งคืนให้ AI โทรต่อ */
export async function releaseCallHold(
  holdId: string,
  reason: 'manual' | 'to_ai' = 'manual',
): Promise<void> {
  const params = new URLSearchParams({ holdId, reason });
  const r = await apiFetch(`/api/matching/call-holds?${params}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'คืนงานโทรไม่สำเร็จ'));
}
