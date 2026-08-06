import { apiFetch } from '@/lib/apiFetch';

export type LumosQueueStatus = 'pending' | 'delivered' | 'completed' | 'failed' | 'cancelled';
export type LumosChannel = 'reminder' | 'interview';

export type LumosCallStatus = {
  channel: LumosChannel;
  /** 'card-<id>' = คนของเรา · 'ir-<id>' = ผู้สมัคร iRecruit */
  person_ref: string;
  status: LumosQueueStatus;
  /** ผลจาก Lumos เช่น confirmed / declined / no_answer / acknowledged / cancelled */
  outcome: string | null;
  summary: string | null;
  delivery_count: number;
  sent_at: string;
  updated_at: string;
};

export type LumosDispatchResult = {
  queued: number;
  duplicated: string[];
  skipped: Array<{ ref: string; name: string; reason: string }>;
  items: LumosCallStatus[];
};

async function readError(r: Response): Promise<string> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; detail?: string; error?: string };
  return data.message || data.detail || data.error || `ไม่สำเร็จ (HTTP ${r.status})`;
}

/** "คนของเรา" ใน pool รอลงงาน — รายชื่อสำหรับเลือกส่งเอง (รวมคนที่เพิ่งเพิ่มเข้ามา) */
export type LumosPoolCandidate = {
  card_id: number;
  full_name: string;
  skills: string | null;
  area: string | null;
  mobile: string | null;
  age: number | null;
  required_salary: number | null;
  last_activity_at: string | null;
  /** ถังบนบอร์ด: 'To do' / 'ไม่มีงาน' / 'Re Use' */
  column_label?: string | null;
  already_sent: boolean;
};

/** ป้ายบอกถังที่มาของผู้สมัคร — To do ไม่ติดป้าย (ค่าปกติ) */
export function boardColumnBadge(label: string | null | undefined): { text: string; cls: string } | null {
  const t = (label || '').trim().toLowerCase();
  if (!t || t === 'to do') return null;
  if (t === 'ไม่มีงาน') return { text: 'รองาน (ไม่มีงาน)', cls: 'border-amber-300 bg-amber-50 text-amber-800' };
  if (t === 're use') return { text: 'คนเก่า Re Use — เช็คสถานะก่อนส่ง', cls: 'border-violet-300 bg-violet-50 text-violet-800' };
  // In process = กำลังถูกเสนอใบขออื่น — ต้องเตือนชัด เสี่ยงเสนอคนเดียวกันซ้อนสองใบ
  if (t === 'in process')
    return {
      text: 'กำลังเสนอใบอื่น — เช็คก่อนว่าใบเดิมจบแล้วหรือยัง',
      cls: 'border-sky-300 bg-sky-50 text-sky-800',
    };
  return { text: label!.trim(), cls: 'border-slate-300 bg-slate-50 text-slate-700' };
}

/** สถานะ+ผลการโทรของทุกคนที่ส่งไปแล้วในใบขอนี้ */
export async function listLumosCallStatus(jobId: string): Promise<LumosCallStatus[]> {
  const r = await apiFetch(`/api/lumos/dispatch?jobId=${encodeURIComponent(jobId)}`);
  if (!r.ok) throw new Error(await readError(r));
  const data = (await r.json()) as { items: LumosCallStatus[] };
  return data.items ?? [];
}

/** สถานะการโทร + pool คนของเราทั้งหมด (ใช้ตอนเปิดหน้าต่างเลือกคนส่งเอง) */
export async function listLumosCallStatusWithPool(
  jobId: string,
): Promise<{ items: LumosCallStatus[]; pool: LumosPoolCandidate[] }> {
  const r = await apiFetch(`/api/lumos/dispatch?jobId=${encodeURIComponent(jobId)}&pool=1`);
  if (!r.ok) throw new Error(await readError(r));
  const data = (await r.json()) as { items?: LumosCallStatus[]; pool?: LumosPoolCandidate[] };
  return { items: data.items ?? [], pool: data.pool ?? [] };
}

/** ค้นใน pool ด้วยชื่อ/สกิล/พื้นที่ — คำค้นหลายคำต้องเจอครบทุกคำ */
export function filterLumosPool(pool: LumosPoolCandidate[], query: string): LumosPoolCandidate[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return pool;
  return pool.filter((c) => {
    const blob = [c.full_name, c.skills, c.area, c.mobile].filter(Boolean).join(' ').toLowerCase();
    return terms.every((t) => blob.includes(t));
  });
}

/** ส่งเฉพาะคนที่ติ๊กเลือก — ส่งแค่ id ฝั่ง server สร้าง payload จากฐานเอง */
export async function dispatchLumosCalls(input: {
  jobId: string;
  boardCardIds: number[];
  irecruitIds: number[];
}): Promise<LumosDispatchResult> {
  const r = await apiFetch('/api/lumos/dispatch', { method: 'POST', body: JSON.stringify(input) });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as LumosDispatchResult;
}

/** ยกเลิกรายการที่ส่งผิด — ได้ผลเฉพาะที่ Lumos ยังไม่ส่งผลกลับ */
export async function cancelLumosCall(input: {
  jobId: string;
  channel: LumosChannel;
  ref: string;
}): Promise<LumosCallStatus[]> {
  const params = new URLSearchParams({ jobId: input.jobId, channel: input.channel, ref: input.ref });
  const r = await apiFetch(`/api/lumos/dispatch?${params.toString()}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await readError(r));
  const data = (await r.json()) as { items: LumosCallStatus[] };
  return data.items ?? [];
}

/** ป้ายสถานะ — รวมสถานะคิวกับผลการโทรเป็นข้อความเดียวที่คนอ่านรู้เรื่อง */
export type LumosCallBadge = { label: string; cls: string; tone: 'idle' | 'sent' | 'good' | 'bad' | 'off' };

const OUTCOME_BADGE: Record<string, LumosCallBadge> = {
  confirmed: { label: '✅ สนใจงาน', cls: 'border-emerald-300 bg-emerald-100 text-emerald-800', tone: 'good' },
  acknowledged: { label: '📗 รับทราบแล้ว', cls: 'border-sky-300 bg-sky-100 text-sky-800', tone: 'sent' },
  completed: { label: '📗 คุยจบแล้ว', cls: 'border-sky-300 bg-sky-100 text-sky-800', tone: 'sent' },
  declined: { label: '❌ ปฏิเสธ', cls: 'border-red-300 bg-red-100 text-red-800', tone: 'bad' },
  no_answer: { label: '📵 ไม่รับสาย', cls: 'border-amber-300 bg-amber-100 text-amber-800', tone: 'bad' },
  unresponsive: { label: '📵 ไม่รับสาย', cls: 'border-amber-300 bg-amber-100 text-amber-800', tone: 'bad' },
  cancelled: { label: '⚠️ AI ยกเลิกสาย', cls: 'border-slate-300 bg-slate-100 text-slate-700', tone: 'off' },
};

const STATUS_BADGE: Record<LumosQueueStatus, LumosCallBadge> = {
  pending: { label: '⏳ รอ AI โทร', cls: 'border-slate-300 bg-slate-100 text-slate-700', tone: 'idle' },
  delivered: { label: '📞 AI รับไปโทรแล้ว', cls: 'border-blue-300 bg-blue-100 text-blue-800', tone: 'sent' },
  completed: { label: '📗 โทรจบแล้ว', cls: 'border-sky-300 bg-sky-100 text-sky-800', tone: 'sent' },
  failed: { label: '⚠️ โทรไม่สำเร็จ', cls: 'border-red-300 bg-red-50 text-red-700', tone: 'bad' },
  cancelled: { label: '⛔ ยกเลิกแล้ว', cls: 'border-slate-300 bg-slate-50 text-slate-500', tone: 'off' },
};

/** ผลการโทรมาก่อนสถานะคิว — outcome บอกเรื่องได้ตรงกว่า 'completed' */
export function lumosCallBadge(row: LumosCallStatus): LumosCallBadge {
  const key = (row.outcome || '').trim().toLowerCase();
  if (key && OUTCOME_BADGE[key]) return OUTCOME_BADGE[key];
  if (key) return { label: `ผลการโทร: ${row.outcome}`, cls: 'border-slate-300 bg-slate-100 text-slate-700', tone: 'sent' };
  return STATUS_BADGE[row.status];
}

/** ยกเลิกได้เฉพาะที่ยังไม่มีผลกลับ (ตรงกับเงื่อนไขฝั่ง API) */
export function canCancelLumosCall(row: LumosCallStatus): boolean {
  return !row.outcome && (row.status === 'pending' || row.status === 'delivered');
}

export function boardPersonRef(cardId: number): string {
  return `card-${cardId}`;
}

export function irecruitPersonRef(id: number): string {
  return `ir-${id}`;
}

/** สรุปผลโทรต่อใบขอ — รูปเดียวกับ lumosSummary จาก /api/matching/list */
export type LumosJobCallSummaryRow = {
  sent: number;
  called: number;
  confirmed: number;
  declined: number;
  no_answer: number;
};

/** รวมสถานะรายคน (ที่โหลดในหน้า detail) เป็นเลขสรุปแบบเดียวกับข้างการ์ด */
export function summarizeLumosCallStatus(items: LumosCallStatus[]): LumosJobCallSummaryRow {
  const s: LumosJobCallSummaryRow = { sent: 0, called: 0, confirmed: 0, declined: 0, no_answer: 0 };
  for (const it of items) {
    if (it.status !== 'cancelled') s.sent += 1;
    const outcome = (it.outcome || '').trim().toLowerCase();
    if (outcome && outcome !== 'cancelled') s.called += 1;
    if (outcome === 'confirmed') s.confirmed += 1;
    if (outcome === 'declined') s.declined += 1;
    if (outcome === 'no_answer' || outcome === 'unresponsive') s.no_answer += 1;
  }
  return s;
}

/** index ตาม person_ref เพื่อหาสถานะของแต่ละคนเร็ว ๆ ตอน render การ์ด */
export function indexLumosCallStatus(items: LumosCallStatus[]): Record<string, LumosCallStatus> {
  const map: Record<string, LumosCallStatus> = {};
  for (const item of items) {
    const prev = map[item.person_ref];
    // ถ้ามีหลายแถว (เคยส่งทั้ง 2 เส้น) เอาแถวที่อัปเดตล่าสุด
    if (!prev || item.updated_at > prev.updated_at) map[item.person_ref] = item;
  }
  return map;
}
