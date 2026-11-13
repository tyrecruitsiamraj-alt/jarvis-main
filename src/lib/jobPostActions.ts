/**
 * ═══ "ทำอะไรไปแล้ว" ของใบขอบนการ์ดหน้าโพสต์ประกาศ (เจ้าของ 13 พ.ย. 2569) ═══
 *
 * > *"โชว์ Action ของใบขอนี้ คือ Autopost เท่าไหร่ gen link โพสต์มือเองเท่าไหร่ Scrap เท่าไหร่ แล้วผลแต่ละอย่างเป็นไง …
 * > พอกดเข้าไปก็ดูแยกได้ว่าของใบนี้ใครเคยส่งไปบ้าง มีกลุ่มไหนบ้าง เก็บ link มาแบบหน้าภาพรวมตรงโพสต์ลงกลุ่ม Facebook"*
 * Choice: Scrap บอกแค่สถานะ · ลิงก์ก่อน 10 พ.ย. ที่ไม่มีป้าย จับคู่ด้วยเวลา
 *
 * pure ใช้ร่วม server/จอ/เทสต์ — ตัวตัดสินว่าลิงก์มาจาก Autopost หรือโพสต์เอง และกองสถานะบนการ์ด อยู่ที่นี่ที่เดียว
 */

export type JobPostLinkOrigin = 'autopost' | 'manual';

/** ลิงก์ที่เกิดก่อนคำสั่ง Autopost ไม่เกินเท่านี้ = ลิงก์ของคำสั่งนั้น (ระบบสร้างลิงก์ต่อกลุ่มแล้วค่อยส่งคำสั่ง ห่างกันไม่กี่วินาที) */
export const AUTOPOST_LINK_BEFORE_MS = 5 * 60_000;
export const AUTOPOST_LINK_AFTER_MS = 60_000;

/**
 * ลิงก์นี้มาจากไหน — ป้าย `note` ชนะ (ระบบเริ่มติดป้าย Autopost / โพสต์เอง ราว 10 พ.ย. 2569)
 * ไม่มีป้าย = ดูว่าเกิดใกล้คำสั่ง Autopost ของใบเดียวกันไหม · ไม่ใกล้ = โพสต์เอง
 */
export function jobPostLinkOrigin(link: { note: string | null; created_at: string }, autopostOrderTimes: readonly number[]): JobPostLinkOrigin {
  const note = (link.note ?? '').trim();
  if (note === 'Autopost') return 'autopost';
  if (note === 'โพสต์เอง') return 'manual';
  const t = new Date(link.created_at).getTime();
  return autopostOrderTimes.some((o) => t >= o - AUTOPOST_LINK_BEFORE_MS && t <= o + AUTOPOST_LINK_AFTER_MS) ? 'autopost' : 'manual';
}

export type JobPostLinkTotals = { links: number; clicks: number; applicants: number };
export type JobPostScrapView = { orders: number; status: string | null; updated_at: string | null };

/** ยอดต่อใบสำหรับการ์ด */
export type JobPostActionsSummary = {
  autopost: { orders: number } & JobPostLinkTotals;
  manual: JobPostLinkTotals;
  scrap: JobPostScrapView;
};

export const EMPTY_JOB_POST_ACTIONS: JobPostActionsSummary = {
  autopost: { orders: 0, links: 0, clicks: 0, applicants: 0 },
  manual: { links: 0, clicks: 0, applicants: 0 },
  scrap: { orders: 0, status: null, updated_at: null },
};

export type JobPostLinkInput = { job_id: string; note: string | null; created_at: string; hit_count: number; applicants: number };
export type JobPostOrderInput = { job_id: string; request_type: 'content' | 'scraping'; status: string; created_at: string; updated_at: string };

/** รวมยอดทุกใบ — ลิงก์แยก Autopost/โพสต์เอง · Scrap = จำนวนคำสั่ง + สถานะของคำสั่งล่าสุด */
export function summarizeJobPostActions(links: readonly JobPostLinkInput[], orders: readonly JobPostOrderInput[]): Record<string, JobPostActionsSummary> {
  const out: Record<string, JobPostActionsSummary> = {};
  const get = (jobId: string) =>
    (out[jobId] ??= { autopost: { ...EMPTY_JOB_POST_ACTIONS.autopost }, manual: { ...EMPTY_JOB_POST_ACTIONS.manual }, scrap: { ...EMPTY_JOB_POST_ACTIONS.scrap } });
  const autopostTimes = new Map<string, number[]>();
  for (const o of orders) {
    const s = get(o.job_id);
    if (o.request_type === 'content') {
      s.autopost.orders += 1;
      autopostTimes.set(o.job_id, [...(autopostTimes.get(o.job_id) ?? []), new Date(o.created_at).getTime()]);
    } else {
      s.scrap.orders += 1;
      if (!s.scrap.updated_at || o.created_at > s.scrap.updated_at) s.scrap = { orders: s.scrap.orders, status: o.status, updated_at: o.created_at };
    }
  }
  for (const l of links) {
    const s = get(l.job_id);
    const bucket = jobPostLinkOrigin(l, autopostTimes.get(l.job_id) ?? []) === 'autopost' ? s.autopost : s.manual;
    bucket.links += 1;
    bucket.clicks += Math.max(0, l.hit_count || 0);
    bucket.applicants += Math.max(0, l.applicants || 0);
  }
  return out;
}

/**
 * กองสถานะโพสต์ลงกลุ่มบนการ์ด 3 ช่อง (เจ้าของ "โพสต์สำเร็จเท่านี้ ไม่สำเร็จเท่านี้ รออนุมัติเท่านี้")
 * เผยแพร่แล้ว = posted · รอ = รอดำเนินการ + รอคิว · ไม่สำเร็จ = ที่เหลือทั้งหมด ⇒ สามช่องบวกกัน = สั่งทั้งหมดเสมอ
 * แยกละเอียดตามคำของ So Scraping อยู่ในป๊อป
 */
export function postGroupBuckets(total: number, counts: Record<string, number>): { posted: number; waiting: number; failed: number } {
  const posted = counts.posted ?? 0;
  const waiting = (counts.pending_approval ?? 0) + (counts.waiting ?? 0);
  return { posted, waiting, failed: Math.max(0, total - posted - waiting) };
}

/**
 * ═══ โพสต์เองรายวัน (การ์ด 6 หน้าภาพรวม · เจ้าของ 13 พ.ย. 2569) ═══
 * > *"อยากดูจำนวนรวมของแต่ละวัน ว่าโพสต์งานไหนไปบ้างจากโพสต์มือ"* → Choice "การ์ดในหน้าภาพรวม"
 * 1 แถวเข้า = ลิงก์ 1 อันใน 1 วัน: วันที่สร้างลิงก์ หรือวันที่กดคัดลอกข้อความ (`recorded` · โพสต์ซ้ำลงกลุ่มเดิมใช้ลิงก์เดิม — เจ้าของ 13 พ.ย.
 * "โพสต์มือไปแล้วของวันนี้ทำไมไม่มีอะไรโชว์เลย") · ไม่ได้กดคัดลอก = ใช้ตัวตัดสินโพสต์เอง/Autopost `jobPostLinkOrigin` ตัวเดียวกับการ์ดหน้าโพสต์ประกาศ
 * 1 ลิงก์ = 1 กลุ่ม/ช่องทาง · คลิก/กรอก = ของวันนั้น (ส่งมาแล้วต่อวัน) ⇒ ลิงก์เดียวโพสต์สองวันไม่นับคลิกซ้ำ
 * ใบขอของแต่ละวันนับไม่ซ้ำในวัน · แถวรวม = ผลบวกทุกวัน (ใบเดียวโพสต์สองวัน = 2) ⇒ ทุกเลขบวกลงตัว
 */
export type ManualPostLinkInput = {
  job_id: string;
  /** วันไทยที่นับว่าโพสต์ */
  day: string;
  /** มาจากการกดคัดลอกข้อความในหน้าโพสต์เอง (นับเป็นโพสต์เองเสมอ) */
  recorded?: boolean;
  note: string | null;
  created_at: string;
  hit_count: number;
  applicants: number;
  channel_label: string | null;
  created_by_name: string | null;
  title: string | null;
};
export type ManualPostDayJob = { jobId: string; title: string | null; by: string[]; places: string[]; clicks: number; applicants: number };
export type ManualPostDay = { day: string; jobs: number; places: number; clicks: number; applicants: number; list: ManualPostDayJob[] };
export type ManualPostDays = { days: ManualPostDay[]; total: { jobs: number; places: number; clicks: number; applicants: number } };

const NO_PLACE = 'ไม่ระบุช่องทาง';

function ymdRange(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); Number.isFinite(t) && t <= end && out.length < 400; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** ทุกวันในช่วงขึ้นเสมอ (ไม่มีโพสต์ = 0) · ใหม่สุดก่อน · `autopostTimes` = เวลาคำสั่ง Autopost ต่อใบ (ไว้แยกลิงก์เก่าที่ไม่มีป้าย) */
export function manualPostDays(
  links: readonly ManualPostLinkInput[],
  autopostTimes: ReadonlyMap<string, readonly number[]>,
  range: { from: string; to: string },
): ManualPostDays {
  const byDay = new Map<string, Map<string, ManualPostDayJob>>();
  for (const l of links) {
    if (!l.recorded && jobPostLinkOrigin(l, autopostTimes.get(l.job_id) ?? []) !== 'manual') continue;
    const day = l.day;
    if (day < range.from || day > range.to) continue;
    const jobs = byDay.get(day) ?? new Map<string, ManualPostDayJob>();
    const j = jobs.get(l.job_id) ?? { jobId: l.job_id, title: l.title, by: [], places: [], clicks: 0, applicants: 0 };
    const who = (l.created_by_name ?? '').trim();
    if (who && !j.by.includes(who)) j.by.push(who);
    j.places.push((l.channel_label ?? '').trim() || NO_PLACE);
    j.clicks += Math.max(0, l.hit_count || 0);
    j.applicants += Math.max(0, l.applicants || 0);
    jobs.set(l.job_id, j);
    byDay.set(day, jobs);
  }
  const days = ymdRange(range.from, range.to)
    .reverse()
    .map((day): ManualPostDay => {
      const list = [...(byDay.get(day)?.values() ?? [])].sort((a, b) => b.places.length - a.places.length || a.jobId.localeCompare(b.jobId));
      const sum = (f: (j: ManualPostDayJob) => number) => list.reduce((acc, j) => acc + f(j), 0);
      return { day, jobs: list.length, places: sum((j) => j.places.length), clicks: sum((j) => j.clicks), applicants: sum((j) => j.applicants), list };
    });
  const total = days.reduce((t, d) => ({ jobs: t.jobs + d.jobs, places: t.places + d.places, clicks: t.clicks + d.clicks, applicants: t.applicants + d.applicants }), { jobs: 0, places: 0, clicks: 0, applicants: 0 });
  return { days, total };
}
