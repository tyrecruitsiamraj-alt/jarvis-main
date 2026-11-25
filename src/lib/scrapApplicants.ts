/**
 * ═══ แท็บ Scrap ทำงานแบบแท็บผู้สมัคร (เจ้าของ 25 พ.ย. 2569) ═══
 * > *"ฉันต้องการให้เลือกเพื่อส่ง Ai โทรได้แบบผู้สมัครเลย มีทุกอย่างเหมือนหน้าผู้สมัคร"*
 * > Choice: *"คงหน้าเดิมแค่ทำให้เหมือนหน้าผู้สมัครไง แยกยอดเป็น Scrap"* · แบบร่างที่เจ้าของ "ทำเลย"
 *
 * - รายชื่อ Scrap ยังอ่านสดจาก So Scraping (ไม่คัดลอกมาเก็บ) — ใบสมัครสร้างตอนกด "ส่ง AI โทร" / "เก็บไปโทรเอง" เท่านั้น
 *   (ยอด "รายชื่อ" ของระบบไม่พองขึ้นจากคนที่ยังไม่มีใครแตะ · เจ้าของไม่เลือกทางดึงเข้าทั้งหมด)
 * - แถวที่ยังไม่มีใบ = ใบเสมือน (id `scrap:<ใบขอ>:<คน>`) หน้าตาเหมือนผู้สมัคร · กดแล้วค่อยสร้างใบจริงแล้วทำต่อด้วยเส้นเดิม
 * - ใบที่สร้างจาก Scrap ไม่ขึ้นแท็บผู้สมัคร (`isScrapApplication`) — อยู่แท็บนี้ที่เดียว · การติดต่อ/นัดหมายใช้ร่วมกันตามเดิม
 * - ชิปไม่ทับกัน ทุกคนอยู่ชิปเดียว ⇒ ชิปรวมกัน = รายชื่อทั้งหมด
 * ตรรกะล้วน (เทสต์ `tests/api/scrapApplicants2569-11-25.test.ts`)
 */
import type { PublicApplication } from './publicApplicationsApi';
import { isInRmTab, rmShownViewOf, RM_LIST_VIEW_LABEL } from './recruitRm';
import {
  isScrapApplication,
  scrapChannelLabel,
  scrapSplitName,
  type ScrapCandidateRow,
  type ScrapResult,
} from './scrapCandidates';
import { SO_SCRAPING_CREATED_BY } from './soScrapingLeads';

export const SCRAP_VIRTUAL_PREFIX = 'scrap:';

export function scrapVirtualId(r: Pick<ScrapCandidateRow, 'request_no' | 'candidate_id'>): string {
  return `${SCRAP_VIRTUAL_PREFIX}${r.request_no}:${r.candidate_id}`;
}

export function isScrapVirtualId(id: string): boolean {
  return id.startsWith(SCRAP_VIRTUAL_PREFIX);
}

export function parseScrapVirtualId(id: string): { requestNo: string; candidateId: string } | null {
  if (!isScrapVirtualId(id)) return null;
  const [requestNo, candidateId] = id.slice(SCRAP_VIRTUAL_PREFIX.length).split(':');
  return requestNo && candidateId ? { requestNo, candidateId } : null;
}

/** ใบขอจริงใน ERP ของเลขใบขอ (So Scraping ผูกด้วยเลขใบขอ) */
export const scrapRequestJobId = (requestNo: string) => `siamraj-sql:${requestNo.toUpperCase()}`;

/** ชิปของแท็บ Scrap — 8 อันแรกชุดเดียวกับแท็บผู้สมัคร (คำเดียวกัน) + 3 อันของ Scrap */
export const SCRAP_LIST_VIEWS = [
  'all',
  'not_sent',
  'ai_waiting',
  'no_pickup',
  'interested',
  'declined',
  'appt_failed',
  'ai_talked',
  'scrap_contact',
  'scrap_applicant',
  'scrap_no_phone',
] as const;
export type ScrapListView = (typeof SCRAP_LIST_VIEWS)[number];
export type ScrapRowView = Exclude<ScrapListView, 'all'>;

export const SCRAP_LIST_VIEW_LABEL: Record<ScrapListView, string> = {
  all: RM_LIST_VIEW_LABEL.all,
  not_sent: RM_LIST_VIEW_LABEL.not_sent,
  ai_waiting: RM_LIST_VIEW_LABEL.ai_waiting,
  no_pickup: RM_LIST_VIEW_LABEL.no_pickup,
  interested: RM_LIST_VIEW_LABEL.interested,
  declined: RM_LIST_VIEW_LABEL.declined,
  appt_failed: RM_LIST_VIEW_LABEL.appt_failed,
  ai_talked: RM_LIST_VIEW_LABEL.ai_talked,
  // มีเจ้าหน้าที่เก็บไปโทรเอง / เก็บเข้าการติดต่อแล้ว (ของใครก็ตาม)
  scrap_contact: 'อยู่ในการติดต่อ',
  // เบอร์นี้สมัครใบขอเดียวกันมาเองแล้ว — นับอยู่แท็บผู้สมัคร
  scrap_applicant: 'อยู่ในผู้สมัคร',
  scrap_no_phone: 'ไม่มีเบอร์',
};

export function isScrapListView(v: string | null | undefined): v is ScrapListView {
  return !!v && (SCRAP_LIST_VIEWS as readonly string[]).includes(v);
}

/** แถวของแท็บ Scrap — ใบจริง (มีใบแล้ว) หรือใบเสมือน (ยังไม่มีใครแตะ) */
export type ScrapWorkRow = {
  app: PublicApplication;
  scrap: ScrapCandidateRow | null;
  view: ScrapRowView;
  virtual: boolean;
};

type JobInfo = { title?: string | null; unitName?: string | null; recruiterName?: string | null };

/** ใบเสมือนจากรายชื่อ Scrap — ช่องที่ตารางผู้สมัครใช้ครบ · วันที่สมัคร = วันที่ So Scraping เจอ */
export function scrapRowAsApplication(s: ScrapCandidateRow, job?: JobInfo | null): PublicApplication {
  const name = scrapSplitName(s.full_name);
  return {
    id: scrapVirtualId(s),
    full_name: s.full_name,
    first_name: name.first,
    last_name: name.last,
    phone: s.phone ?? '',
    age: s.age ?? undefined,
    gender: s.gender ?? undefined,
    province: s.province ?? undefined,
    job_id: scrapRequestJobId(s.request_no),
    job_title: job?.title ?? undefined,
    unit_name: job?.unitName ?? undefined,
    responsible_name: job?.recruiterName ?? undefined,
    channel_label: scrapChannelLabel(s.platform),
    created_by_name: SO_SCRAPING_CREATED_BY,
    status: 'new',
    created_at: s.found_at ?? '',
  };
}

/** ใบจริงอยู่ชิปไหน — ใบผู้สมัครที่มาเอง = "อยู่ในผู้สมัคร" · มีคนเก็บไปแล้ว = "อยู่ในการติดต่อ" · ที่เหลือใช้กติกาแท็บผู้สมัคร */
export function scrapViewOfApplication(app: PublicApplication): ScrapRowView {
  if (!isScrapApplication(app)) return 'scrap_applicant';
  if (!isInRmTab(app, 'candidates')) return 'scrap_contact';
  const v = rmShownViewOf(app);
  // ใบจาก Scrap ผูกใบขอเสมอ และไม่ใช่รายชื่อ iRecruit — สองชิปนี้ของแท็บผู้สมัครไม่มีทางเกิด ถ้าเกิดให้ถือว่ายังไม่ส่ง
  return v === 'irecruit_pull' || v === 'no_job' ? 'not_sent' : v;
}

/**
 * รวมรายชื่อ Scrap กับใบสมัครที่โหลดมาแล้ว → แถวของแท็บ Scrap (คนละหนึ่งแถว)
 * - มีใบในใบขอเดียวกัน (จับด้วยเบอร์ฝั่ง server) และเห็นใบนั้น = ใช้ใบจริง (ป๊อป/ผลโทรเหมือนผู้สมัคร)
 * - มีใบแต่มองไม่เห็น (การติดต่อของคนอื่น) = ใบเสมือนในชิป "อยู่ในการติดต่อ"
 * - ใบจาก Scrap ที่ So Scraping ไม่มีคนนั้นแล้ว = ยังขึ้น (ไม่หายเงียบ) ผลประเมินไม่รู้
 * - เบอร์เดียวกันในใบขอเดียวกันหลายแถว = แถวเดียว
 */
export function buildScrapWorkRows(
  apps: readonly PublicApplication[],
  scrapRows: readonly ScrapCandidateRow[],
  jobOf: (jobId: string) => JobInfo | null = () => null,
): ScrapWorkRow[] {
  const byId = new Map(apps.map((a) => [a.id, a] as const));
  const out: ScrapWorkRow[] = [];
  const seen = new Set<string>();
  for (const s of scrapRows) {
    const inj = s.in_jarvis;
    const app = inj ? byId.get(inj.application_id) : undefined;
    if (app) {
      if (seen.has(app.id)) continue;
      seen.add(app.id);
      out.push({ app, scrap: s, view: scrapViewOfApplication(app), virtual: false });
      continue;
    }
    const key = s.phone ? `${s.request_no}|${s.phone}` : scrapVirtualId(s);
    if (seen.has(key)) continue;
    seen.add(key);
    const view: ScrapRowView = !s.phone
      ? 'scrap_no_phone'
      : inj
        ? inj.is_lead || inj.claimed
          ? 'scrap_contact'
          : 'scrap_applicant'
        : 'not_sent';
    out.push({ app: scrapRowAsApplication(s, jobOf(scrapRequestJobId(s.request_no))), scrap: s, view, virtual: true });
  }
  for (const a of apps) {
    if (seen.has(a.id) || !isScrapApplication(a)) continue;
    seen.add(a.id);
    out.push({ app: a, scrap: null, view: scrapViewOfApplication(a), virtual: false });
  }
  return out;
}

/** ผลประเมินของแถว — ใบที่ So Scraping ไม่มีคนนั้นแล้ว = ยังไม่ประเมิน */
export const scrapResultOfRow = (r: ScrapWorkRow): ScrapResult => r.scrap?.result ?? 'unscored';

/** นับต่อชิป — ทุกชิปรวมกัน = ทั้งหมด */
export function countScrapViews(rows: readonly ScrapWorkRow[]): Record<ScrapListView, number> {
  const out = Object.fromEntries(SCRAP_LIST_VIEWS.map((v) => [v, 0])) as Record<ScrapListView, number>;
  for (const r of rows) {
    out[r.view] += 1;
    out.all += 1;
  }
  return out;
}
