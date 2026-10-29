/**
 * ═══ แท็บการติดต่อ ภาพรวมงานสรรหา (เจ้าของ 29 ต.ค. 2569) ═══
 * เจ้าของ: *"หน้านี้จะทำงานต่อจาก แท็บ ใบขอ … ไอคนที่ prescreen มาแล้วเป็นสนใจ … โทรแล้ว เป็นไง … และต้องบอกช่องทางเหมือนกันนะ"*
 * Choice: ฐาน = ตอบ AI ว่าสนใจอย่างเดียว (ตัวเดียวกับช่อง "สนใจ" ของแท็บใบขอ `applicantCallBucketOf`) · ยังไม่รู้ผลนัดแยก 2 ช่อง ·
 * ไม่มี % Success (เจ้าของ "Success ฉันแค่นิยาม") · ของเดิมในแท็บอยู่ต่อท้าย
 *
 * สนใจ = รอติดต่อ + ติดต่อไม่สำเร็จ + ติดต่อสำเร็จ
 * ติดต่อสำเร็จ = นัดไม่สำเร็จ + ยังไม่ลงนัด + นัดได้
 * นัดได้ = มา + ไม่มา + ยังไม่ถึงวันนัด + เลยวันนัดยังไม่ลงผล
 * ไฟล์นี้ pure — เทสต์ `tests/api/recruitContactTab2569-10-29.test.ts`
 */
import { staffResultOf } from '@/lib/recruitJourney';
import { funnelChannelOf, funnelGroupOf, type FunnelGroupKey } from '@/lib/channelFunnel';
import { applicantCallBucketOf, FUNNEL_GROUP_LABEL } from '@/lib/recruitRequestTab';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

export type ContactBucket = 'waiting' | 'fail' | 'apptFailed' | 'apptNone' | 'showed' | 'noShow' | 'upcoming' | 'overdue';
export const CONTACT_BUCKET_LABEL: Record<ContactBucket, string> = {
  waiting: 'รอติดต่อ',
  fail: 'ติดต่อไม่สำเร็จ',
  apptFailed: 'นัดไม่สำเร็จ',
  apptNone: 'ยังไม่ลงนัด',
  showed: 'มา',
  noShow: 'ไม่มา',
  upcoming: 'ยังไม่ถึงวันนัด',
  overdue: 'เลยวันนัด ยังไม่ลงผล',
};
export const CONTACT_OK: readonly ContactBucket[] = ['apptFailed', 'apptNone', 'showed', 'noShow', 'upcoming', 'overdue'];
export const CONTACT_BOOKED: readonly ContactBucket[] = ['showed', 'noShow', 'upcoming', 'overdue'];

/** คนที่ตอบ AI ว่าสนใจ — ฐานของแท็บ (ตัวเดียวกับช่องสนใจของแท็บใบขอ) */
export const isInterested = (f: RecruitAppFact) => applicantCallBucketOf(f) === 'yes';

/** ขั้นของคนที่สนใจหนึ่งคน · ลงผลเลื่อนนัด = ดูวันนัดว่าถึงหรือยัง */
export function contactBucketOf(f: RecruitAppFact, now: Date): ContactBucket {
  const s = staffResultOf(f);
  if (s === 'waiting') return 'waiting';
  if (s === 'fail') return 'fail';
  if (f.appointmentAt) {
    if (f.attendance === 'showed') return 'showed';
    if (f.attendance === 'no_show') return 'noShow';
    return new Date(f.appointmentAt).getTime() > now.getTime() ? 'upcoming' : 'overdue';
  }
  return f.appointmentFailed ? 'apptFailed' : 'apptNone';
}

export type ContactRow = {
  key: string;
  name: string;
  /** สนใจ */
  total: number;
  ok: number;
  booked: number;
  counts: Record<ContactBucket, number>;
  /** id ต่อช่อง — กดดูรายชื่อ */
  ids: Record<ContactBucket | 'total' | 'ok' | 'booked', string[]>;
  children?: ContactRow[];
};

const BUCKETS = Object.keys(CONTACT_BUCKET_LABEL) as ContactBucket[];

function rowOf(key: string, name: string, list: readonly RecruitAppFact[], now: Date): ContactRow {
  const ids = Object.fromEntries([...BUCKETS, 'total', 'ok', 'booked'].map((k) => [k, [] as string[]])) as ContactRow['ids'];
  for (const f of list) {
    const b = contactBucketOf(f, now);
    const id = f.id ?? '';
    ids[b].push(id);
    ids.total.push(id);
    if (CONTACT_OK.includes(b)) ids.ok.push(id);
    if (CONTACT_BOOKED.includes(b)) ids.booked.push(id);
  }
  const counts = Object.fromEntries(BUCKETS.map((b) => [b, ids[b].length])) as Record<ContactBucket, number>;
  return { key, name, total: list.length, ok: ids.ok.length, booked: ids.booked.length, counts, ids };
}

/** แถวรวม + ช่องทางหลัก (มากไปน้อย) › ช่องทางรอง · `apps` = ทุกใบสมัครของช่วง (กรองคนสนใจข้างใน) */
export function buildContactRows(apps: readonly RecruitAppFact[], now: Date): { total: ContactRow; groups: ContactRow[] } {
  const yes = apps.filter(isInterested);
  const groups = new Map<FunnelGroupKey, Map<string, RecruitAppFact[]>>();
  for (const f of yes) {
    const ch = funnelChannelOf(f);
    const g = funnelGroupOf(ch);
    const chans = groups.get(g) ?? new Map<string, RecruitAppFact[]>();
    chans.set(ch, [...(chans.get(ch) ?? []), f]);
    groups.set(g, chans);
  }
  const out = [...groups.entries()].map(([g, chans]) => {
    const row = rowOf(g, FUNNEL_GROUP_LABEL[g], [...chans.values()].flat(), now);
    row.children = [...chans.entries()].map(([ch, list]) => rowOf(`${g}:${ch}`, ch, list, now)).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'th'));
    return row;
  });
  return { total: rowOf('total', 'รวมทุกช่องทาง', yes, now), groups: out.sort((a, b) => b.total - a.total) };
}
