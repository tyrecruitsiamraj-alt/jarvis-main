/**
 * ═══ สายพานงาน So Recruit — โครงเมนูใหม่ (เจ้าของเคาะจากต้นแบบ 26 ส.ค. 2569) ═══
 *
 * 🔴 **ทำไมต้องมีไฟล์นี้** (จาก audit UX 25 ส.ค. 2569 ที่วัดจริง):
 * เมนูเดิมเป็นรายการเรียบ 7 อัน (หน้าหลัก · หน่วยงาน · Follow · ดูแลหลังเริ่มงาน · WL ·
 * ผู้สมัคร · Dashboard) — **ไม่มีอะไรบอกว่าอะไรมาก่อนอะไร** คนใหม่เปิดมาเจอปุ่ม 61 ปุ่ม
 * บนหน้าแรกแล้วไม่รู้ว่าต้องเริ่มตรงไหน · `/matching/match` ซึ่งเป็นหัวใจของงาน
 * **ไม่อยู่ในเมนูเลย** (ถอดออก 17 ส.ค. เพราะหัวข้อแม่ว่าง เลยพาลูกหายไปด้วย)
 *
 * โครงใหม่ = **งานจริงเดินเป็นลำดับ** · ของที่ไม่ใช่ขั้นตอน (คลังคน · WL · Dashboard)
 * แยกเป็นกลุ่ม "คลังข้อมูล" ต่างหาก ไม่ปนกับลำดับงาน
 *
 * 🔴 **28 ส.ค. 2569 เหลือ 4 หน้า และเลิกใช้เลขขั้น** — เจ้าของตัด "ประกาศรับ" กับ
 * "ผู้สมัคร" ออกเพราะซ้ำกับแท็บในกล่องงาน · เปลี่ยน "จับคู่ & โทร" เป็น "จับคู่งาน"
 * และเลิกโชว์ "ขั้นที่ N/6" ทุกที่ (เหตุผลเต็มอยู่บน type `ConveyorStep`)
 *
 * ⚠️ **ไม่ได้สร้าง route ใหม่สักเส้น** — ทุกขั้นชี้ไปหน้าที่มีอยู่แล้ว
 * (ขั้น 2/3 คือ `?view=` ของบอร์ดรับสมัคร ซึ่งเป็นหน้าเดียวหลายมุมมองอยู่แล้ว)
 * เพิ่ม route ใหม่ = ต้องแก้ rbac/registry ตามอีกหลายที่ ซึ่งไม่ใช่เรื่องของการจัดเมนู
 */
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  LayoutGrid,
  CalendarDays,
  ClipboardList,
  Megaphone,
  PhoneCall,
  PhoneForwarded,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AppFunctionId } from '@/lib/roleFunctions';

/** ตัวนับที่แปะท้ายเมนูได้ — คีย์ตรงกับที่ `conveyorBadges()` คำนวณให้ */
export type ConveyorBadgeKey =
  | 'today'
  | 'requests'
  | 'postings'
  | 'applicants'
  | 'matching'
  | 'follow'
  | 'aftercare';

export type ConveyorStep = {
  /**
   * 🔴 **ไม่มี `step: number` แล้ว** (เจ้าของสั่ง 28 ส.ค. 2569)
   * > *"ไม่เอาตัวเลข ขอเป็นสัญลักษณ์ที่บ่งบอกถึงข้อนั้น ๆ ไม่ต้องแยก ขอเป็นอันเดียวกัน
   * >  ตอนนี้มันมีขีดคั่นไว้ไม่เอา"*
   * > *"หกขั้น ตลกมาก จะมีชื่อคำนี้ทำไม ในเมื่อมันคือใบขอ ก็ใช้ชื่อใบขอสิ"*
   *
   * ⇒ เมนูและหัวหน้าจอใช้ **ไอคอน + ชื่อหน้า** เป็นชิ้นเดียว ไม่มีเลขขั้น ไม่มี `·` คั่น
   * (ลำดับของงานยังอยู่ในลำดับของ array นี้ · ใครอยากรู้ว่าอันไหนมาก่อนก็อ่านจากลำดับ)
   */
  key: ConveyorBadgeKey;
  label: string;
  /** ประโยคเดียวว่าขั้นนี้ทำอะไร — ขึ้นใต้หัวข้อหน้า ไม่ใช่แค่ tooltip */
  blurb: string;
  path: string;
  icon: LucideIcon;
  functionId?: AppFunctionId;
  /**
   * path ที่ถือว่า "อยู่ขั้นนี้" นอกจาก `path` เอง — ใช้ไฮไลต์เมนูและหา
   * ขั้นของหน้าปัจจุบัน · ต้องเรียงจากเจาะจงไปกว้าง (ดู `stepForPath`)
   */
  match: string[];
};

/**
 * คลังข้อมูล — ของที่ **ไม่ใช่ขั้นตอนของงาน** แต่เปิดดูได้ตลอดเวลา
 * แยกกลุ่มเพราะเอาไปปนในสายพานแล้วเลข "ขั้นที่ N" จะเพี้ยนทันที
 */
export type VaultItem = {
  key: string;
  label: string;
  blurb: string;
  path: string;
  icon: LucideIcon;
  functionId?: AppFunctionId;
  match: string[];
};

/** ขั้น 0 = "วันนี้" (หน้าแรก) — ไม่ใช่ขั้นของสายพาน แต่เป็นทางเข้าอันดับหนึ่ง */
export const CONVEYOR_HOME = {
  key: 'today' as const,
  /** เจ้าของสั่งเปลี่ยนจาก "วันนี้" → "หน้าหลัก" (27 ส.ค. 2569) */
  label: 'หน้าหลัก',
  blurb: 'งานถัดไปของคุณ เรียงตามความด่วนให้แล้ว',
  path: '/',
  icon: PhoneCall,
};

/**
 * ═══ ลำดับงาน — เหลือ 4 หน้า (เจ้าของตัด 2 ออก 28 ส.ค. 2569) ═══
 *
 * 🔴 **ถอด "ประกาศรับ" ออก** — *"ไม่ต้องมีเพราะมันอยู่อันเดียวกับกล่องงาน เอาขึ้นมาก็มีแต่
 * จะทำให้งง เพราะในกล่องงานมันอยู่ในช่องชื่อ คำขอโพสต์งานใหม่"*
 * 🔴 **ถอด "ผู้สมัคร" ออก** — *"ก็ไม่ต้องมีเพราะมันอยู่ในกล่องงาน ช่อง รายชื่อผู้สมัคร"*
 * 🔴 **"จับคู่ & โทร" → "จับคู่งาน"** และ *"ย้ายไปไว้ใต้ใบขอ"*
 *
 * ⚠️ ทั้งสองหน้าที่ถอด **ไม่ได้ถูกลบ** — ยังเปิดได้ที่แท็บในกล่องงาน
 * (`?view=postings` / `?view=list`) แค่ไม่มีชื่อของตัวเองในเมนูอีก
 * ⇒ กล่องงานจึงเป็นเจ้าของ `/jobs/board` เต็มตัว ไม่มีขั้นไหนมาแย่ง `match` แล้ว
 */
export const CONVEYOR_STEPS: ConveyorStep[] = [
  {
    key: 'requests',
    label: 'ใบขอ',
    blurb: 'หน่วยงานขอคนมา — ทุกใบบอกตัวเองว่าค้างมานานเท่าไหร่',
    path: '/jobs/list',
    icon: ClipboardList,
    match: ['/jobs/list', '/jobs/siamraj', '/jobs/overview'],
  },
  {
    key: 'matching',
    label: 'จับคู่งาน',
    blurb: 'AI แนะนำคนให้แต่ละใบ แล้วส่งเข้าคิวโทรหรือรับไปโทรเอง',
    path: '/matching/match',
    icon: PhoneCall,
    match: ['/matching/match', '/matching/pre-check', '/matching/contact', '/matching/reservations'],
  },
  {
    key: 'follow',
    label: 'ติดตาม',
    blurb: 'ตามคนที่รับปากแล้ว จนถึงวันเริ่มงานจริง',
    path: '/follow',
    icon: PhoneForwarded,
    match: ['/follow'],
  },
  {
    key: 'aftercare',
    label: 'ดูแลหลังเริ่มงาน',
    blurb: 'เริ่มงานแล้วยังต้องตาม — กันหลุดในเดือนแรก',
    path: '/aftercare',
    icon: UserCheck,
    match: ['/aftercare'],
  },
];

export const CONVEYOR_VAULT: VaultItem[] = [
  /**
   * 🔴 **กล่องงาน** — เจ้าของทัก 27 ส.ค. 2569: *"ใน Menu ไม่เห็นมีคำไหนที่บอกว่า
   * จะพาไปหน้ากล่องงานเลย"* · หน้านี้มีมาตลอดแต่เข้าได้ทางเดียวคือกดจากที่อื่น
   * เพราะขั้น 2/3 ของสายพานจองมุมมอง `?view=postings` / `?view=list` ไว้
   * ส่วนกล่องงานคือ `/jobs/board` **ที่ไม่มี `?view=`** จึงไม่มีเมนูไหนชี้ถึง
   * ⚠️ อยู่กลุ่ม "คลังข้อมูล" ไม่ใช่สายพาน — มันเป็นมุมมองรวมของทุกใบ ไม่ใช่ขั้นของงาน
   */
  {
    key: 'job-boxes',
    label: 'กล่องงาน',
    blurb: 'ใบขอทั้งหมดแยกเป็นกล่องตามสถานะ — กำลังสรรหา · คัดเลือก · รอเริ่มงาน · ปิดแล้ว',
    path: '/jobs/board',
    icon: LayoutGrid,
    functionId: 'unit_requests_read',
    match: [],
  },
  {
    key: 'candidates',
    label: 'คลังคน',
    blurb: 'ทุกคนที่เคยผ่านระบบ — ค้นย้อนหลังได้',
    path: '/matching/candidates',
    icon: Users,
    functionId: 'candidates_read',
    match: ['/matching/candidates', '/matching/our-people'],
  },
  {
    key: 'wl',
    label: 'WL · ปฏิทินกำลังคน',
    blurb: 'คนที่ทำงานอยู่แล้ววันนี้',
    path: '/wl',
    icon: CalendarDays,
    functionId: 'work_calendar_read',
    match: ['/wl'],
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    blurb: 'ภาพรวมสำหรับผู้จัดการ',
    path: '/dashboard',
    icon: BarChart3,
    functionId: 'dashboard',
    match: ['/dashboard'],
  },
];

/**
 * ชื่อขั้นตามคีย์ — 🔴 **หัวหน้าจอต้องเรียกใช้ตัวนี้ ห้ามพิมพ์ชื่อหน้าเอง**
 *
 * audit มุมพนักงานใหม่ 26 ส.ค. 2569 พบว่า **ชื่อเมนูไม่ตรงกับชื่อหัวหน้า 4 ใน 6 ขั้น**
 * (เมนู `ใบขอ` → หน้า "หน่วยงาน" · `จับคู่ & โทร` → "Matching — คนของเรา" ·
 * `ติดตาม` → "Follow" · `ประกาศรับ`/`ผู้สมัคร` → "บอร์ดงานเปิดรับ · เจ้าหน้าที่")
 * ⇒ คนใหม่กดเมนูแล้วไม่แน่ใจว่ามาถูกหน้าไหม · มีเทสต์คุมว่าไม่มีหน้าไหนพิมพ์ชื่อเอง
 */
export function conveyorLabel(key: ConveyorBadgeKey): string {
  if (key === 'today') return CONVEYOR_HOME.label;
  return CONVEYOR_STEPS.find((s) => s.key === key)?.label ?? '';
}

/** ตัดคิวรีสตริงออกก่อนเทียบ — เมนูขั้น 2/3 เป็น `?view=` ของหน้าเดียวกัน */
function pathOnly(target: string): string {
  const q = target.indexOf('?');
  return q === -1 ? target : target.slice(0, q);
}

/** `?view=` ที่เมนูขั้นนี้เป็นเจ้าของ — `null` = ขั้นนี้ไม่ได้ผูกกับมุมมองไหน */
function ownView(step: ConveyorStep): string | null {
  return new URLSearchParams(step.path.split('?')[1] ?? '').get('view');
}

/**
 * คะแนน "หน้านี้เป็นของขั้นนี้แค่ไหน" — `null` = ไม่ใช่ · เลขยิ่งมากยิ่งเจาะจง
 *
 * 🔴 **สองเรื่องที่ต้องตัดสินพร้อมกัน** จึงรวมเป็นฟังก์ชันเดียว ไม่แยกสองชุด:
 * 1. **เจาะจงชนะกว้าง** — `/jobs/siamraj/x` ต้องได้ขั้น 1 ไม่ใช่ขั้น 3
 *    ให้คะแนนตามความยาว prefix ไม่ใช่ลำดับในลิสต์ (เพิ่มขั้นใหม่แล้วลำดับเปลี่ยน
 *    ไม่ควรทำให้ผลเปลี่ยน)
 * 2. **ขั้น 2 กับ 3 ใช้ path เดียวกัน** (`/jobs/board`) ต่างแค่ `?view=`
 *    ⇒ ต้องอ่าน query ด้วย ไม่งั้นสว่างพร้อมกันสองอัน · ไม่มี `?view=` = กล่องงาน
 *    ซึ่งเป็นทางเข้าหลักของ **ขั้น 3** (ผู้สมัคร)
 */
function stepScore(step: ConveyorStep, pathname: string, search: string): number | null {
  const own = pathOnly(step.path);
  const view = ownView(step);
  let best: number | null = null;
  for (const prefix of [own, ...step.match]) {
    if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) continue;
    /**
     * มุมมองของบอร์ดรับสมัครตัดสินด้วย `?view=` เท่านั้น (ขั้น 2 vs 3)
     *
     * 🔴 **ไม่มี `?view=` = "กล่องงาน" ไม่ใช่ขั้นไหนของสายพาน** (แก้ 27 ส.ค. 2569)
     * เดิม default เป็น `'list'` ⇒ `/jobs/board` เปล่า ๆ นับเป็นขั้น 3 เพราะตอนนั้น
     * ยังไม่มีเมนูของกล่องงาน เลยยืมขั้น 3 เป็นทางเข้า · พอเจ้าของทักว่าเมนูไม่มี
     * ทางไปกล่องงานและเราเพิ่มเข้าคลังข้อมูลแล้ว การยืมนั้นทำให้**สว่างพร้อมกันสองที่**
     * ⇒ ใช้ `'board'` เป็นค่าตั้งต้นแทน ซึ่งไม่มีขั้นไหนเป็นเจ้าของ
     */
    if (prefix === own && (view !== null || own === '/jobs/board')) {
      const current = new URLSearchParams(search).get('view');
      if ((current ?? 'board') !== (view ?? 'board')) continue;
    }
    if (best === null || prefix.length > best) best = prefix.length;
  }
  return best;
}

/**
 * ขั้นของหน้าที่เปิดอยู่ — `null` = หน้านี้ไม่อยู่ในสายพาน (คลังข้อมูล/ตั้งค่า/หน้าแรก)
 * `search` ไม่ส่งมาก็ได้ (หน้าที่ไม่ได้อยู่บนบอร์ดรับสมัครไม่ต้องใช้)
 */
export function stepForPath(pathname: string, search = ''): ConveyorStep | null {
  let best: { step: ConveyorStep; score: number } | null = null;
  for (const step of CONVEYOR_STEPS) {
    const score = stepScore(step, pathname, search);
    if (score === null) continue;
    if (!best || score > best.score) best = { step, score };
  }
  return best ? best.step : null;
}

/** เมนูขั้นนี้ควรไฮไลต์ไหม — หน้าหนึ่งหน้าเป็นของขั้นเดียวเสมอ */
export function isStepActive(step: ConveyorStep, pathname: string, search: string): boolean {
  return stepForPath(pathname, search)?.key === step.key;
}

export function isVaultActive(item: VaultItem, pathname: string, search = ''): boolean {
  const hit = [item.path, ...item.match].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!hit) return false;
  /**
   * 🔴 บอร์ดรับสมัครเป็นหน้าเดียวสามมุมมอง — "กล่องงาน" คือมุมมองที่**ไม่มี `?view=`**
   * (หรือ `?view=board`) · ไม่เช็คตรงนี้ กล่องงานจะสว่างพร้อมขั้น 2/3 ของสายพาน
   * ตลอดเวลา ซึ่งคือปัญหาเดียวกับที่ `stepScore` แก้ไว้ฝั่งสายพาน
   */
  if (pathname === '/jobs/board') {
    const view = new URLSearchParams(search).get('view');
    return view === null || view === 'board';
  }
  return true;
}

/**
 * ตัวเลขท้ายเมนู — **`null` = ยังไม่รู้ ห้ามวาดเป็น 0**
 * (กติกาเดิมของหน้าแรก: 0 ที่รู้จริงกับ "ยังโหลดไม่ได้" คนละเรื่องกัน — วาด 0 ทั้งที่
 * ไม่รู้ = จอโกหกว่างานหมดแล้ว ซึ่งแย่กว่าจอที่เงียบ)
 */
export type ConveyorCounts = Partial<Record<ConveyorBadgeKey, number | null>>;

/**
 * 🔴 **ป้ายเลขท้ายเมนูนับคนละเรื่องกันทุกขั้น** — และเดิมไม่มีอะไรบอกคนดูเลย
 * (audit มุมพนักงานใหม่ 26 ส.ค. 2569: เห็น "ประกาศรับ 1" ข้าง ๆ หน้าแรกที่บอก
 * "ประกาศแล้ว 176" แล้วสรุปว่าระบบมั่ว · ความจริงคือคนละเมตริกกันคนละตัว)
 *
 * ตารางนี้คือ **คำแปลของเลขแต่ละอัน** ใช้ทั้งใน tooltip ของเมนูและใน `homeDeck`
 * ⚠️ แก้ที่ `useConveyorCounts` เมื่อไหร่ ต้องแก้ประโยคตรงนี้ให้ตรงด้วยเสมอ
 */
export const CONVEYOR_BADGE_MEANING: Record<ConveyorBadgeKey, string> = {
  today: 'จำนวนเรื่องที่ต้องลงมือวันนี้',
  requests: 'ใบขอที่ยังเปิดอยู่ทั้งหมด (ยอดสะสม ไม่ใช่ของที่ต้องทำวันนี้)',
  postings: 'คำขอโพสต์งานที่ยังไม่จบ — ไม่ใช่จำนวนใบขอที่ประกาศแล้ว',
  applicants: 'ผู้สมัครที่ยังไม่มีใครแตะเกิน 1 วัน (ไม่ใช่ผู้สมัครทั้งหมด)',
  matching: 'ใบขอที่ AI หาคนมาแนะนำให้แล้ว — ไม่ใช่จำนวนสายที่ต้องโทร',
  follow: 'คนที่เลยเวลานัดโทรแล้วยังไม่มีผลกลับ',
  aftercare: 'คนที่อยู่ในรอบดูแลหลังเริ่มงาน',
};

/** ป้ายสั้นต่อท้ายเลข — ตัดมาจากประโยคเต็มข้างบน ใช้ตรงที่พื้นที่แคบ */
export const CONVEYOR_BADGE_SHORT: Record<ConveyorBadgeKey, string> = {
  today: 'ต้องลงมือ',
  requests: 'ใบเปิดอยู่',
  postings: 'คำขอค้าง',
  applicants: 'รอคัดกรอง',
  matching: 'ใบมีคนแนะนำ',
  follow: 'เลยนัด',
  aftercare: 'คนต้องดูแล',
};

export type ConveyorBadge = {
  value: number;
  /** ต้องลงมือ = ป้ายแดง (ไม่ใช่แค่ "มีของอยู่เท่านี้") */
  urgent: boolean;
};

export function conveyorBadge(
  counts: ConveyorCounts,
  key: ConveyorBadgeKey,
  urgentKeys: readonly ConveyorBadgeKey[] = ['today', 'applicants', 'follow'],
): ConveyorBadge | null {
  const v = counts[key];
  if (typeof v !== 'number') return null;
  return { value: v, urgent: v > 0 && urgentKeys.includes(key) };
}

/* ── ก้อนทีมบนหน้าแรก — ปุ่มนำทางล้วน (เจ้าของสั่ง 26 ส.ค. 2569) ─────────────
 * 🔴 ที่มา: บอร์ด "ทีมปฏิบัติการ · ใครทำอะไรอยู่" (ฉาก iso + เมตริก 4 ทีม) ถูกเจ้าของ
 * สั่งถอดทั้งดวง: *"เอาออก เสียเวลากะมันมาเยอะและไม่ถูกใจสักที แต่เอาก้อนทีมต่าง ๆ
 * มาทำให้มันกดแล้วนำทางไปแทน"* ⇒ เหลือแค่การ์ดทีมกดได้ ไม่มีตัวเลข ไม่มีฉาก
 * (อย่าเอาเมตริก/ฉากกลับมาใส่การ์ดพวกนี้อีก — ตีตกไปแล้ว)
 */
export type HomeTeamNavKey = 'online' | 'recruit' | 'closing' | 'lumos';

export const HOME_TEAM_NAV: Array<{
  key: HomeTeamNavKey;
  label: string;
  blurb: string;
  /** `null` = ไม่มีหน้าปลายทาง (กดแล้วทำอย่างอื่นแทน — ดูตัววาด) */
  path: string | null;
}> = [
  /**
   * ⚠️ ต้องใช้ path **เดียวกับขั้น "ประกาศรับ" ในเมนูสายพาน** (`/jobs/board?view=postings`)
   * เดิมชี้ `/matching/job-postings` ซึ่งเป็นคนละหน้า ⇒ กดจากเมนูซ้ายกับกดจากก้อนทีม
   * ได้คนละหน้าทั้งที่เป็นเรื่องเดียวกัน (เทสต์ "กันลิงก์ตาย" จับได้ 26 ส.ค. 2569)
   */
  { key: 'online', label: 'ทีม Online', blurb: 'ประกาศรับ · Content · Scraping', path: '/jobs/board?view=postings' },
  { key: 'recruit', label: 'ทีมสรรหา', blurb: 'ผู้สมัคร · คัดกรอง · นัดสัมภาษณ์', path: '/jobs/board?view=list' },
  { key: 'closing', label: 'ทีมปิดใบขอ', blurb: 'จับคู่ · ผลโทร · ปิดใบขอ', path: '/matching/match' },
  /**
   * 🔴 `path: null` โดยตั้งใจ — ระบบ**ไม่มีหน้าของทีม Lumos** (ผลโทรอยู่ใน dialog
   * บนหน้าแรก + ปนอยู่ในหน้าจับคู่) · เจ้าของเคาะ 26 ส.ค. 2569 ว่า "กดแล้วเปิด dialog
   * ผลโทร" ไม่สร้างหน้าใหม่ · ถ้าวันหน้าทำหน้า /lumos ค่อยใส่ path แล้วแก้ตัววาด
   */
  { key: 'lumos', label: 'ทีม Lumos', blurb: 'AI โทรแทนทีม · ผลสายทั้งหมด', path: null },
];
