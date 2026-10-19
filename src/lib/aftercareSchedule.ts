/**
 * ═══ หน้าดูแลหลังเริ่มงาน: ตั้งรอบ/ตัวกรองเจ้าของงาน/ย้อนกลับ (เจ้าของ 19 ต.ค. 2569) ═══ — ตรรกะล้วน
 * เทสต์ `tests/api/aftercareRework2569-10-19.test.ts`
 */
import { AFTERCARE_TOPIC } from '@/lib/aftercareRounds';
import { phoneKey } from '@/lib/followDuplicateGuard';
import type { FollowEntry } from '@/lib/followApi';
import type { AftercarePerson } from '@/lib/aftercareApi';

type PendingLike = Pick<
  FollowEntry,
  'id' | 'recipient_phone' | 'topic' | 'cancelled' | 'completed_at' | 'call_outcome' | 'scheduled_at' | 'group_id' | 'call_mode' | 'staff_phone' | 'start_date'
> & { staff_call_outcome?: string | null };

/**
 * สายถามความเป็นอยู่ของคนนี้ที่ยังแก้ได้ (ไม่ยกเลิก · ยังไม่ปิด · ยังไม่มีผล · เวลาอนาคต) — **ชุดเดียว**
 * (`replaceFollowSchedule` แก้ได้ทีละชุด) = ชุดของสายที่ใกล้สุด · เรียงตามเวลา
 */
export function pendingAftercareRounds<T extends PendingLike>(calls: readonly T[], phone: string, now: Date): T[] {
  const key = phoneKey(phone);
  if (!key) return [];
  const minAt = now.getTime() + 60_000;
  const open = calls
    .filter(
      (c) =>
        (c.topic ?? '').trim() === AFTERCARE_TOPIC &&
        phoneKey(c.recipient_phone) === key &&
        !c.cancelled &&
        !c.completed_at &&
        !c.call_outcome &&
        !c.staff_call_outcome &&
        c.scheduled_at != null &&
        Date.parse(c.scheduled_at) > minAt,
    )
    .sort((a, b) => Date.parse(a.scheduled_at as string) - Date.parse(b.scheduled_at as string));
  if (open.length === 0) return [];
  const group = open[0].group_id ?? null;
  return group ? open.filter((c) => c.group_id === group) : [open[0]];
}

/** ตัวเลือกเจ้าของงาน (ก-ฮ) — คนที่ยังไม่รู้เจ้าของไม่มีตัวเลือก */
export function aftercareOwnerOptions(people: readonly Pick<AftercarePerson, 'owner_name'>[]): string[] {
  const set = new Set<string>();
  for (const p of people) {
    const v = (p.owner_name ?? '').trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'th'));
}

/** กรองตามเจ้าของงาน · '' = ทุกคน */
export function filterAftercareByOwner<T extends Pick<AftercarePerson, 'owner_name'>>(people: readonly T[], owner: string): T[] {
  if (!owner) return [...people];
  return people.filter((p) => (p.owner_name ?? '').trim() === owner);
}

/** ปิดตอนย้ายได้ก่อนแถวดูแลเกิดเล็กน้อย (ย้าย = ลงทะเบียนก่อน แล้วปิดทีหลัง) — เผื่อนาฬิกาเหลื่อม */
const MOVE_SLACK_MS = 10 * 60_000;

/**
 * สายของแผนติดตามเดิมที่ปิดเป็น "ไปแล้ว" ตอนกดย้าย — ย้อนกลับต้องเปิดคืนพวกนี้ (คนกลับไปการ์ดติดตามครบ)
 * ชุด = `follow_group_id` (ไม่มี = สาย `from_follow_id` สายเดียว) · ปิดหลังย้ายเท่านั้น (ปิดก่อนหน้านั้นเป็นผลจริงของคน ห้ามแตะ)
 */
export function revertReopenIds(
  entries: readonly Pick<FollowEntry, 'id' | 'group_id' | 'topic' | 'cancelled' | 'completed_at' | 'outcome_code'>[],
  person: Pick<AftercarePerson, 'from_follow_id' | 'follow_group_id' | 'created_at'>,
): string[] {
  if (!person.from_follow_id) return [];
  const since = Date.parse(person.created_at ?? '') - MOVE_SLACK_MS;
  return entries
    .filter(
      (e) =>
        (person.follow_group_id ? e.group_id === person.follow_group_id : e.id === person.from_follow_id) &&
        (e.topic ?? '').trim() !== AFTERCARE_TOPIC &&
        !e.cancelled &&
        e.outcome_code === 'went' &&
        !!e.completed_at &&
        (Number.isNaN(since) || Date.parse(e.completed_at) >= since),
    )
    .map((e) => e.id);
}
