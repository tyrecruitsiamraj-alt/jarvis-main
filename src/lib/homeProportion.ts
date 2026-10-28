/**
 * ═══ แท็บ "สัดส่วน" หน้าหลัก — แต่ละเรื่อง AI ทำเท่าไหร่ คนทำเท่าไหร่ (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"ใช้เพื่อดูว่าระบบเนี่ย คนหรือ Ai ทำไปเท่าไหร่ เรื่องไหนจะผลักดันให้ Ai เยอะ เรื่องไหนคนก็ปล่อยไป
 * > ฉันต้องตอบผู้บริหารเวลาเขาถามว่าตอนนี้ระบบไปกี่ %"*
 *
 * Choice เจ้าของ:
 *   - เรื่องที่มี: ติดตามคนเริ่มงาน · ติดตามส่งคนแทน · ดูแลหลังเริ่มงาน · สรรหา 3 ขั้น (Prescreen · โทรหลัง Prescreen · นัดได้)
 *     + จับคู่งาน · AI โทรไม่ติดแล้วคนตามต่อ · ทางเข้าของงาน · ขั้นที่ยังเป็นคน 100% ("เอามาก่อน อันไหนไม่เอาค่อยเอาออก")
 *   - **ไม่มีเลขรวมเลขเดียว** — แยกรายเรื่อง (แต่ละเรื่องนับคนละหน่วย)
 *   - **% = AI ได้โทร รวมที่คนตามต่อ** — (AI + ทั้งสองทาง) ÷ งานที่ทำแล้ว · ยังไม่มีงาน = null (ห้ามขึ้น 0% ให้ดูเหมือนคนทำหมด)
 *   - ชื่อแท็บ "สัดส่วน" (ไม่ใช่ "AI กับคน")
 *
 * ไฟล์นี้ pure — ตัวเลขจาก `/api/home-ai-share?proportion=1` (ติดตาม · ทางเข้า) + ใบสมัครของหน้าหลัก (`ro.apps`) + ก้อนจับคู่งาน
 * เทสต์ `tests/api/homeProportion2569-10-28.test.ts`
 */
import type { RecruitAppFact } from './recruitOverviewTypes';
import type { AiShareMatching } from './homeAiShare';

/** ติดตาม / ดูแลหลังเริ่มงาน หนึ่งก้อน — สายที่ถึงเวลาในช่วง ไม่นับยกเลิก */
export type ProportionCallCounts = {
  /** AI โทรอย่างเดียว */
  ai: number;
  /** AI โทรแล้วคนลงผลด้วย (ทั้งสองทาง) */
  both: number;
  /** คนโทรอย่างเดียว */
  staff: number;
  /** ยังไม่มีใครโทร */
  none: number;
  /** AI โทรแล้วไม่ได้คุย (ไม่รับ · สายไม่ว่าง · ล้ม) */
  aiUnreached: number;
};

export type ProportionPayload = {
  generated_at: string;
  from: string | null;
  to: string | null;
  bu: string | null;
  follow: { starter: ProportionCallCounts; replacement: ProportionCallCounts; aftercare: ProportionCallCounts } | null;
  entry: {
    /** ผู้สมัครกรอกเอง (ลิงก์/หน้าประกาศ) */
    selfApply: number;
    /** ดึงจาก iRecruit */
    irecruit: number;
    /** So Scraping ส่งเข้ามา */
    soScraping: number;
    /** เจ้าหน้าที่คีย์ / นำเข้า Excel */
    staffKeyed: number;
    /** ใบส่งคนแทน ดึงจาก iRecruit / คีย์เอง (นับใบ) */
    replaceSync: number;
    replaceManual: number;
    /** สั่งโพสต์ผ่านระบบ (So Scraping) — คนโพสต์เองระบบไม่เห็น */
    postOrders: number;
  } | null;
  errors: { follow?: string; entry?: string };
};

export type ProportionTag = 'ai' | 'mix' | 'staff' | 'noAi' | 'empty' | 'unknown';
export const PROPORTION_TAG_LABEL: Record<ProportionTag, string> = {
  ai: 'AI ทำหลัก',
  mix: 'แบ่งกัน',
  staff: 'คนทำหลัก',
  noAi: 'ยังไม่มี AI',
  empty: 'ยังไม่มีงาน',
  unknown: 'วัดไม่ได้',
};

export type ProportionRow = {
  key: string;
  name: string;
  /** บรรทัดเล็กใต้ชื่อ (หน่วย + ตัวเลขประกอบ) */
  note: string;
  ai: number;
  both: number;
  staff: number;
  none: number;
  /** ป้ายของก้อนว่าง (ยังไม่โทร · ยังไม่มีใครโทร) */
  noneLabel?: string;
  /** ทางเข้าใช้คำว่า ระบบ / คน แทน AI / คน */
  aiLabel?: string;
  /** วัดไม่ได้ (โพสต์ประกาศ) — ไม่มีแถบ ไม่มี % */
  unknown?: boolean;
};

export type ProportionGroup = { key: string; title: string; rows: ProportionRow[] };

/** % ของ AI (รวมทั้งสองทาง) ในงานที่ทำแล้ว · ยังไม่มีงาน = null */
export function proportionPct(r: Pick<ProportionRow, 'ai' | 'both' | 'staff'>): number | null {
  const done = r.ai + r.both + r.staff;
  return done > 0 ? Math.round(((r.ai + r.both) / done) * 100) : null;
}

export function proportionTag(r: ProportionRow): ProportionTag {
  if (r.unknown) return 'unknown';
  const p = proportionPct(r);
  if (p === null) return 'empty';
  if (p === 0) return 'noAi';
  if (p >= 60) return 'ai';
  if (p >= 30) return 'mix';
  return 'staff';
}

const NUM = new Intl.NumberFormat('th-TH');
const n = (v: number) => NUM.format(v);

const msOf = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : Number.NaN);

/**
 * สรรหา 3 ขั้น + ขั้นที่ยังเป็นคน จากใบสมัครชุดเดียวกับหน้าหลัก (`ro.apps` · ช่วง/BU เดียวกัน)
 * - Prescreen: ใบที่โทรแล้วโดย AI / คน / ทั้งคู่ (`calledByAi` / `calledByStaff` · หลักฐานชุดเดียวกับกล่องงาน)
 * - โทรหลัง Prescreen: คนที่บอก AI ว่าสนใจ → เจ้าหน้าที่ลงมือหลังคำตอบนั้น (ยังไม่มี AI โทรขั้นนี้)
 * - นัดได้: มีวันนัด — วันนัดมาจากบันทึกของเจ้าหน้าที่เท่านั้น (บันทึกติดต่อ / คนถือ)
 */
export function recruitProportionRows(apps: readonly RecruitAppFact[]): { recruit: ProportionRow[]; human: ProportionRow[] } {
  let ai = 0;
  let both = 0;
  let staff = 0;
  let none = 0;
  let yes = 0;
  let yesFollowed = 0;
  let appts = 0;
  let showed = 0;
  let noShow = 0;
  let passed = 0;
  let notPassed = 0;
  let informed = 0;
  for (const a of apps) {
    if (a.calledByAi && a.calledByStaff) both += 1;
    else if (a.calledByAi) ai += 1;
    else if (a.calledByStaff) staff += 1;
    else none += 1;
    if (a.aiAnswer === 'said_yes') {
      yes += 1;
      if (msOf(a.staffLastAt) >= msOf(a.aiAnswerAt)) yesFollowed += 1;
    }
    if (a.appointmentAt) appts += 1;
    if (a.attendance === 'showed') showed += 1;
    else if (a.attendance) noShow += 1;
    if (a.screening === 'passed') passed += 1;
    else if (a.screening === 'not_passed') notPassed += 1;
    if (a.informed === true) informed += 1;
  }
  return {
    recruit: [
      { key: 'prescreen', name: 'AI โทร Prescreen', note: `ใบสมัคร ${n(apps.length)} ใบ`, ai, both, staff, none, noneLabel: 'ยังไม่โทร' },
      {
        key: 'afterPrescreen',
        name: 'โทรหลัง Prescreen',
        note: `คนที่บอก AI ว่าสนใจ ${n(yes)} คน`,
        ai: 0,
        both: 0,
        staff: yesFollowed,
        none: yes - yesFollowed,
        noneLabel: 'ยังไม่มีใครโทร',
      },
      { key: 'appointment', name: 'นัดมาสมัครได้', note: `${n(appts)} นัด`, ai: 0, both: 0, staff: appts, none: 0 },
    ],
    human: [
      { key: 'attendance', name: 'ลงผลมา / ไม่มาตามนัด', note: `มา ${n(showed)} · ไม่มา ${n(noShow)}`, ai: 0, both: 0, staff: showed + noShow, none: 0 },
      { key: 'screening', name: 'ผ่าน / ไม่ผ่าน', note: `ผ่าน ${n(passed)} · ไม่ผ่าน ${n(notPassed)}`, ai: 0, both: 0, staff: passed + notPassed, none: 0 },
      { key: 'inform', name: 'แจ้งเข้า ERP', note: `${n(informed)} คน`, ai: 0, both: 0, staff: informed, none: 0 },
    ],
  };
}

function followRow(key: string, name: string, c: ProportionCallCounts): ProportionRow {
  const unreached = c.aiUnreached > 0 ? ` · AI โทรไม่ติด ${n(c.aiUnreached)} คนตามต่อ ${n(c.both)}` : '';
  return { key, name, note: `สาย${unreached}`, ai: c.ai, both: c.both, staff: c.staff, none: c.none, noneLabel: 'ยังไม่มีใครโทร' };
}

const ZERO: ProportionCallCounts = { ai: 0, both: 0, staff: 0, none: 0, aiUnreached: 0 };

/** ทุกก้อนของแท็บ — ลำดับตามเส้นทางงาน · ว่างแล้วไม่หาย (ขึ้น 0) */
export function buildProportionGroups(input: {
  apps: readonly RecruitAppFact[] | null;
  payload: ProportionPayload | null;
  matching: AiShareMatching | null;
}): ProportionGroup[] {
  const r = recruitProportionRows(input.apps ?? []);
  const m = input.matching;
  const matching: ProportionRow = {
    key: 'matching',
    name: 'จับคู่งาน',
    note: 'คน',
    ai: m?.ai ?? 0,
    both: m?.both ?? 0,
    staff: m?.staff ?? 0,
    none: m?.notCalled ?? 0,
    noneLabel: 'ยังไม่มีใครโทร',
  };
  const f = input.payload?.follow;
  const e = input.payload?.entry;
  const appsIn = e ? e.selfApply + e.irecruit + e.soScraping : 0;
  return [
    { key: 'recruit', title: 'งานสรรหา', rows: [...r.recruit, matching] },
    {
      key: 'follow',
      title: 'ติดตามและดูแล',
      rows: [
        followRow('starter', 'ติดตามคนเริ่มงาน', f?.starter ?? ZERO),
        followRow('replacement', 'ติดตามส่งคนแทน', f?.replacement ?? ZERO),
        followRow('aftercare', 'ดูแลหลังเริ่มงาน', f?.aftercare ?? ZERO),
      ],
    },
    {
      key: 'entry',
      title: 'ทางเข้าของงาน',
      rows: [
        {
          key: 'apps',
          name: 'ผู้สมัครเข้าระบบ',
          note: e
            ? `สมัครเอง ${n(e.selfApply)} · ดึง iRecruit ${n(e.irecruit)}${e.soScraping ? ` · So Scraping ${n(e.soScraping)}` : ''} · คนคีย์/นำเข้า ${n(e.staffKeyed)}`
            : 'ใบสมัคร',
          ai: appsIn,
          both: 0,
          staff: e?.staffKeyed ?? 0,
          none: 0,
          aiLabel: 'ระบบ',
        },
        {
          key: 'replaceSheets',
          name: 'ใบส่งคนแทน',
          note: e ? `ดึง iRecruit ${n(e.replaceSync)} · คีย์เอง ${n(e.replaceManual)}` : 'ใบ',
          ai: e?.replaceSync ?? 0,
          both: 0,
          staff: e?.replaceManual ?? 0,
          none: 0,
          aiLabel: 'ระบบ',
        },
        {
          key: 'posts',
          name: 'โพสต์ประกาศ',
          note: `สั่งโพสต์ผ่านระบบ ${n(e?.postOrders ?? 0)} ครั้ง · โพสต์เองระบบไม่เห็น`,
          ai: 0,
          both: 0,
          staff: 0,
          none: 0,
          unknown: true,
        },
      ],
    },
    { key: 'human', title: 'ขั้นที่ยังเป็นคน 100%', rows: r.human },
  ];
}
