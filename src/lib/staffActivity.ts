/**
 * ═══ งานรายคน (เจ้าของ 18 พ.ย. 2569 "อยากรู้ว่าวันนี้ เมื่อวาน วันก่อน ใหม่ทำอะไรไป โพสต์มือเอง Autopost scrap"
 * · Choice "ภาพรวม แต่เพิ่ม Filter ให้ดูรายคนได้") ═══
 * นับจากงานที่บันทึกในระบบ (ใครทำ · วันไหน ตามปฏิทินกรุงเทพ) — ตัวดึงอยู่ `api/_handlers/staff-activity.ts`
 */
export const STAFF_ACTIVITY_KINDS = ['autopost', 'scrap', 'links', 'manualPosted', 'contacts', 'appts'] as const;
export type StaffActivityKind = (typeof STAFF_ACTIVITY_KINDS)[number];

/** หัวคอลัมน์ — คำที่คนในทีมใช้ */
export const STAFF_ACTIVITY_LABEL: Record<StaffActivityKind, string> = {
  autopost: 'Autopost (ใบ)',
  scrap: 'Scrap (ใบ)',
  links: 'สร้างลิงก์โพสต์เอง',
  manualPosted: 'ติ๊กโพสต์เองแล้ว',
  contacts: 'ลงผลติดต่อ',
  appts: 'นัดได้',
};

/** `login` = ชื่ออีเมลหน้า @ — ไว้แยกคนชื่อซ้ำในรายการเลือกคน (20 พ.ย. 2569) */
export type StaffActivityRow = { userId: string; name: string; bu: string | null; day: string; login?: string } & Record<StaffActivityKind, number>;

/**
 * คนที่มีงานในช่วง `STAFF_ROSTER_DAYS` วันล่าสุด (นับถึงวันสุดท้ายของช่วงที่ดู) + วันที่ทำล่าสุด
 * ตาราง "แยกตามคน" ของแท็บ Scale ลง ใช้ขึ้นคนที่ช่วงนี้ไม่มีงานเลย ("ใครไม่ทำอะไร หายไปกี่วัน" · เจ้าของ 20 พ.ย. 2569)
 */
export type StaffRosterRow = { userId: string; name: string; bu: string | null; lastDay: string };
export const STAFF_ROSTER_DAYS = 60;

/** ความเคลื่อนไหวล่าสุด — at = ISO · kind = คำบนจอ (สั่ง Autopost / สร้างลิงก์โพสต์เอง / ติดต่อสำเร็จ …) */
export type StaffActivityFeedItem = { at: string; kind: string; who: string; subject: string | null; detail: string | null; applicationId: string | null; requestNo: string | null };

/** `at` = เวลาที่ทำ (ISO) · `jobId` = ใบขอ/กล่องลอยของรายการ (`siamraj-sql:` · `siamraj-pre:` · `standalone:`) — แท็บงานรายคน 20 พ.ย. 2569 */
export type StaffActivityItem = { day: string; title: string; sub: string | null; applicationId: string | null; requestNo: string | null; at?: string | null; jobId?: string | null };

/* ═══ งานรายคน รายวัน (เจ้าของ 20 พ.ย. 2569 "เจมส์ทำไรไปบ้างวันนี้ เมื่อวาน วันนี้กะเมื่อวานเจมส์ทำไรเยอะกว่า" ·
 * "ถ้าบอกว่าทำอะไร แล้วทำไปช่องทางไหน ทำไมไม่คิดต่อยอดให้เลย" · "ทำไว้อีกแท็บของ หน้าภาพรวม") ═══
 * ทำอะไร (6 ชนิดงาน นิยามเดียวกับตารางรายคน) → ช่องทางไหน → ใบไหน → ได้อะไรกลับมา (คลิก · กรอก ของลิงก์ที่คนนี้รับผิดชอบ) */
export type StaffKindCounts = Record<StaffActivityKind, number>;
/** ลำดับ + คำบนจอของแท็บงานรายคน (คำเดียวกับตารางรายคนของการสั่งงาน) */
export const STAFF_PERSON_KINDS: ReadonlyArray<{ key: StaffActivityKind; label: string }> = [
  { key: 'links', label: 'Gen link' },
  { key: 'manualPosted', label: 'โพสต์แล้ว' },
  { key: 'scrap', label: 'Scrap' },
  { key: 'autopost', label: 'Autopost' },
  { key: 'contacts', label: 'ลงผลติดต่อ' },
  { key: 'appts', label: 'ลงนัด' },
];
export type StaffPersonSub = { label: string; n: number };
export type StaffPersonJob = { jobId: string; label: string; autopost: number; scrap: number; links: number; manualPosted: number; clicks: number; applicants: number };
export type StaffPersonDay = {
  day: string;
  prevDay: string;
  /** 7 วัน (เก่า → ใหม่) ทุกวันอยู่ครบ ว่าง = 0 */
  week: Array<{ day: string } & StaffKindCounts>;
  cur: StaffKindCounts;
  prev: StaffKindCounts;
  /** ช่องทาง/ผล ของวันที่ดู ต่อชนิดงาน — รวมเท่าเลขของชนิดนั้น */
  channels: Record<StaffActivityKind, StaffPersonSub[]>;
  results: { clicks: number; clicksPrev: number; applicants: number; applicantsPrev: number };
  /** ใบขอ/กล่องลอยที่มีงาน คลิก หรือคนกรอกในวันที่ดู — ทุกคอลัมน์รวมเท่าแถวแม่ */
  jobs: StaffPersonJob[];
};
/**
 * แถวย่อย — ช่องทาง/ผล + จำนวน · Autopost = บัญชี + จำนวนกลุ่ม (บอกจำนวนใบเมื่อเกิน 1)
 * ใช้ทั้งแท็บงานรายคนและแท็บ Scale ลง · ไฟล์นี้ใช้ฝั่ง API ด้วย จึงไม่ import ตัวจัดเลขของหน้าเว็บ (รูปเลขเดียวกัน)
 */
export const staffSubText = (kind: StaffActivityKind, c: StaffPersonSub): string =>
  kind === 'autopost' ? `${c.label}${c.n > 1 ? ` (${c.n.toLocaleString('th-TH')} ใบ)` : ''}` : `${c.label} ${c.n.toLocaleString('th-TH')}`;
export const emptyStaffKinds = (): StaffKindCounts => ({ autopost: 0, scrap: 0, links: 0, manualPosted: 0, contacts: 0, appts: 0 });
/** งานทั้งหมด — ลงนัดเป็นส่วนหนึ่งของลงผลติดต่อ (แถวเดียวกันในสมุดติดต่อ) จึงไม่บวกซ้ำ */
export const staffWorkTotal = (r: StaffKindCounts): number => r.autopost + r.scrap + r.links + r.manualPosted + r.contacts;
/** วันก่อนหน้า (YYYY-MM-DD) */
export function ymdAddDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** ทุกช่อง 0 (คนไม่มีงาน / ยังไม่มีใครให้เลือก) — ตารางอยู่ครบ ไม่หาย */
export function emptyStaffPersonDay(from: string, to: string, day: string): StaffPersonDay {
  const week: StaffPersonDay['week'] = [];
  for (let d = from; d <= to; d = ymdAddDays(d, 1)) week.push({ day: d, ...emptyStaffKinds() });
  return {
    day,
    prevDay: ymdAddDays(day, -1),
    week,
    cur: emptyStaffKinds(),
    prev: emptyStaffKinds(),
    channels: { autopost: [], scrap: [], links: [], manualPosted: [], contacts: [], appts: [] },
    results: { clicks: 0, clicksPrev: 0, applicants: 0, applicantsPrev: 0 },
    jobs: [],
  };
}
/** คนเริ่มต้นของแท็บ — งานมากสุดของวันที่ดู › งานมากสุดของช่วง › ไม่มี */
export function defaultStaffPerson(rows: readonly StaffActivityRow[], day: string): string | null {
  const best = (list: readonly StaffActivityRow[]) => staffActivityTotals(list).sort((a, b) => staffWorkTotal(b) - staffWorkTotal(a) || a.name.localeCompare(b.name, 'th'))[0]?.userId ?? null;
  return best(rows.filter((r) => r.day === day)) ?? best(rows);
}
/** ตัวเลือกคน — ชื่อซ้ำกันต่อท้ายชื่ออีเมลหน้า @ ให้แยกออก */
export function staffPersonOptions(rows: readonly StaffActivityRow[]): Array<{ value: string; label: string }> {
  const people = staffActivityTotals(rows);
  const seen = new Map<string, number>();
  for (const p of people) seen.set(p.name, (seen.get(p.name) ?? 0) + 1);
  const loginOf = new Map(rows.map((r) => [r.userId, r.login ?? '']));
  return people
    .map((p) => ({ value: p.userId, label: `${p.name}${(seen.get(p.name) ?? 0) > 1 && loginOf.get(p.userId) ? ` (${loginOf.get(p.userId)})` : ''}${p.bu ? ` · ${p.bu}` : ''}` }))
    .sort((a, b) => a.label.localeCompare(b.label, 'th'));
}

/** รวมทุกวันต่อคน (ตัวกรอง "ทุกคน") · เรียงงานมากไปน้อย */
export function staffActivityTotals(rows: readonly StaffActivityRow[]): StaffActivityRow[] {
  const m = new Map<string, StaffActivityRow>();
  for (const r of rows) {
    const cur = m.get(r.userId) ?? { userId: r.userId, name: r.name, bu: r.bu, day: '', login: r.login, autopost: 0, scrap: 0, links: 0, manualPosted: 0, contacts: 0, appts: 0 };
    for (const k of STAFF_ACTIVITY_KINDS) cur[k] += r[k];
    m.set(r.userId, cur);
  }
  const sum = (r: StaffActivityRow) => STAFF_ACTIVITY_KINDS.reduce((n, k) => n + r[k], 0);
  return [...m.values()].sort((a, b) => sum(b) - sum(a) || a.name.localeCompare(b.name, 'th'));
}
