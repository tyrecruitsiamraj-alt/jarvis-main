/**
 * ═══ แก้ตารางทั้งชุดหลังบันทึก (เจ้าของ Choice 1 ต.ค. 2569 "แก้ตารางหลังบันทึกไม่ได้ → แก้") ═══
 *
 * เดิมกล่องแก้ไขแก้ได้ทีละสาย จะเปลี่ยนตารางต้องยกเลิกทั้งชุดแล้วตั้งใหม่ · ตอนนี้เปิด "แก้ตารางทั้งชุด" ในกล่องเดิม
 * (ไม่ซ้อน Dialog) → เห็นทุกสายที่ยังแก้ได้ · ย้ายวันเวลา · สลับ AI โทร/คนโทร · เอาออก · เพิ่มสาย →
 * `PATCH /api/follow` action `replace_schedule` (ฝั่ง API ตรวจซ้ำทุกข้อ + ส่งแผนใหม่ให้ Lumos)
 *
 * 🔴 สายที่ **โทรไปแล้ว/เลยเวลาแล้ว** แก้ไม่ได้ (ประวัติ) — โชว์เป็นรายการอ่านอย่างเดียว
 * · เวลาในช่องเป็นเวลาไทยเสมอ (`+07:00`) ไม่ขึ้นกับเขตเวลาของเครื่องคนใช้
 * ไฟล์นี้ pure — เทสต์ที่ `src/lib/followScheduleEdit.test.ts`
 */
import type { FollowEntry } from '@/lib/followApi';

/**
 * สายที่จะถึงเวลาภายในกี่นาทีถือว่าแก้ไม่ได้แล้ว (8 ต.ค. 2569) — ตารางที่ส่งไปบันทึกมีทุกสายที่ยังแก้ได้ของชุด
 * ฝั่ง API ไม่รับสายที่เหลือไม่ถึง 1 นาที ⇒ สายคอนเฟิร์ม 16:00 ตอน 15:59 ทำให้ทั้งชุดถูกตีกลับ (ทีมสลับสายพรุ่งนี้เป็น AI ไม่ได้)
 * เผื่อเวลาเปิดป๊อปจนกดบันทึก · สายที่ไม่ได้ส่งไป = คงเดิมทุกอย่าง
 */
export const EDIT_LOCK_BEFORE_MS = 3 * 60_000;

/** สายนี้ยังแก้ได้ไหม — ยังไม่ยกเลิก/ปิดงาน · อีกเกิน 3 นาทีถึงเวลา · AI ยังไม่ได้โทร / คนโทรยังไม่ได้ลงผล */
export function isEditableFollowRound(e: FollowEntry, now: Date): boolean {
  if (e.cancelled || e.completed_at) return false;
  const at = Date.parse(e.scheduled_at ?? '');
  if (!Number.isFinite(at) || at <= now.getTime() + EDIT_LOCK_BEFORE_MS) return false;
  if (e.call_mode === 'manual') return !e.staff_call_outcome;
  return (e.call_status == null || e.call_status === 'pending') && !e.call_outcome && !e.called_at;
}

/**
 * สายของ "ชุดเดียวกัน" ที่ยังไม่ยกเลิก — มี `group_id` = แถวที่ group เดียวกัน · ไม่มี (แถวเก่า) = พี่น้องที่ไม่มี group
 * ⚠️ ห้ามดึงแถวของชุดอื่นมาปน — ฝั่ง API จะผูกทุกสายที่แก้เข้าชุดของแถวที่เปิด (ทับ group เดิมของชุดอื่น)
 */
export function followSetRows(entry: FollowEntry, siblings: readonly FollowEntry[]): FollowEntry[] {
  const pool = siblings.some((s) => s.id === entry.id) ? siblings : [entry, ...siblings];
  return pool.filter((s) => !s.cancelled && (entry.group_id ? s.group_id === entry.group_id : !s.group_id));
}

const BKK_INPUT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** ISO → ค่าในช่อง `DateTimeField24` (YYYY-MM-DDTHH:MM เวลาไทย) */
export function isoToBangkokInput(iso: string | null | undefined): string {
  const d = new Date(iso ?? '');
  if (Number.isNaN(d.getTime())) return '';
  const p = Object.fromEntries(BKK_INPUT.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** ค่าในช่อง (เวลาไทย) → ISO · อ่านไม่ออก = null */
export function bangkokInputToIso(value: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export type ScheduleDraftRow = {
  /** คีย์ของแถวบนจอ (สายเดิม = id · สายใหม่ = new-N) */
  key: string;
  /** สายเดิม = id ของแถว · สายใหม่ = null */
  id: string | null;
  /** ค่าในช่องวันเวลา (เวลาไทย) */
  when: string;
  mode: 'ai' | 'manual';
};

const byTime = (a: { scheduled_at?: string | null }, b: { scheduled_at?: string | null }) =>
  Date.parse(a.scheduled_at ?? '') - Date.parse(b.scheduled_at ?? '');

/** สายที่ยังแก้ได้ → แถวเริ่มต้นของตัวแก้ (เรียงตามเวลา) */
export function draftFromRows(rows: readonly FollowEntry[]): ScheduleDraftRow[] {
  return [...rows].sort(byTime).map((r) => ({
    key: r.id,
    id: r.id,
    when: isoToBangkokInput(r.scheduled_at),
    mode: r.call_mode === 'manual' ? 'manual' : 'ai',
  }));
}

/** สายใหม่ที่กด "เพิ่มสาย" — เวลาเดิมของสายสุดท้ายในวันถัดไป · ไม่มีสายเลย = อีกหนึ่งชั่วโมงข้างหน้า (ปัดเป็นต้นชั่วโมง) */
export function nextDraftRow(draft: readonly ScheduleDraftRow[], now: Date, key: string): ScheduleDraftRow {
  const last = draft[draft.length - 1];
  const lastIso = last ? bangkokInputToIso(last.when) : null;
  const base = lastIso ? new Date(Date.parse(lastIso) + 86_400_000) : new Date(Math.ceil((now.getTime() + 3_600_000) / 3_600_000) * 3_600_000);
  return { key, id: null, when: isoToBangkokInput(base.toISOString()), mode: last?.mode ?? 'ai' };
}

/** ตรวจก่อนบันทึก — เวลาต้องอ่านออก · เป็นอนาคต (เหลืออย่างน้อย 1 นาที) · ไม่ซ้ำนาทีกัน (กติกาเดียวกับฝั่ง API) */
export function validateScheduleDraft(
  draft: readonly ScheduleDraftRow[],
  now: Date,
): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const seen = new Map<number, string>();
  for (const row of draft) {
    const iso = bangkokInputToIso(row.when);
    if (!iso) {
      errors[row.key] = 'ตั้งวันและเวลาให้ครบ';
      continue;
    }
    const at = Date.parse(iso);
    if (at < now.getTime() + 60_000) {
      errors[row.key] = 'เวลานี้ผ่านไปแล้ว — เลือกเวลาข้างหน้า';
      continue;
    }
    const minute = Math.floor(at / 60_000);
    if (seen.has(minute)) {
      errors[row.key] = 'ซ้ำกับอีกสายเวลาเดียวกัน';
      continue;
    }
    seen.set(minute, row.key);
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/** body ของคำขอแก้ตาราง — สายที่แก้ได้ทั้งหมด + ตารางใหม่ (สายที่หายจากตาราง = เอาออก) */
export function scheduleReplaceBody(
  editable: readonly FollowEntry[],
  draft: readonly ScheduleDraftRow[],
): { replace_ids: string[]; rounds: Array<{ id?: string; scheduled_at: string; call_mode: 'ai' | 'manual' }> } {
  return {
    replace_ids: editable.map((e) => e.id),
    rounds: draft.flatMap((r) => {
      const iso = bangkokInputToIso(r.when);
      if (!iso) return [];
      return [{ ...(r.id ? { id: r.id } : {}), scheduled_at: iso, call_mode: r.mode }];
    }),
  };
}

/** มีอะไรเปลี่ยนจากตอนเปิดไหม — ไม่เปลี่ยน = ไม่ต้องยิง (กันกดบันทึกเปล่าแล้วแผนถูกส่งใหม่โดยไม่จำเป็น) */
export function scheduleDraftChanged(initial: readonly ScheduleDraftRow[], draft: readonly ScheduleDraftRow[]): boolean {
  const norm = (rows: readonly ScheduleDraftRow[]) =>
    rows.map((r) => `${r.id ?? 'new'}|${bangkokInputToIso(r.when) ?? r.when}|${r.mode}`).sort().join(';');
  return norm(initial) !== norm(draft);
}
