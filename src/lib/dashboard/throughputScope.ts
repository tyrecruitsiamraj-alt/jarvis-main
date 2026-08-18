import type { ThroughputRecord } from '@/lib/dashboard/throughput';

/**
 * **กรอง throughput ให้ตามตัวกรองทุกตัวบน Dashboard** ไม่ใช่แค่ BU + ช่วงวันที่
 * (เจ้าของสั่ง 18 ส.ค. 2569: *"เลือกเจ้าหน้าสรรหาชื่อ คิว ในเดือนนั้นมีเข้ามาเท่าไหร่
 * ก็เปลี่ยนตาม ฉุกเฉิน/ย้อนหลัง ฉุกเฉิน ล่วงหน้า เท่าไหร่"*)
 *
 * 🔴 **ทำไมต้องมีไฟล์นี้** — `throughputRecords` มาจาก **SQL Server (ERP)** ซึ่ง
 * *ไม่มี* ข้อมูลผู้รับผิดชอบ/โน้ต/สถานะงาน (พวกนี้อยู่ PostgreSQL ฝั่ง Jarvis แล้วถูก
 * แนบเข้า `JobRequest` ตอนอ่าน) → กรองที่ตัว record ตรง ๆ ไม่ได้
 * ต้องกรองด้วย **รายการเลขที่ใบที่ผ่านตัวกรองแล้ว** ที่ฝั่ง jobs คำนวณมาให้
 *
 * 🔴 **คีย์ต้องเป็นเลขที่ใบดิบ** — `job.externalId` (ดิบ) ตรงกับ `record.requestNo` (ดิบ)
 * ส่วน `job.request_no` เป็นเลข**ที่โชว์บนจอ** (เติม prefix ให้แถวที่ ERP เก็บเป็นเลขล้วน)
 * ใส่ทั้งสองแบบลง set เพื่อกันแถวที่ ERP เก็บต่างรูปแบบกัน
 *
 * 🔴 **ใบที่ไม่รู้จักต้องถูกตัด ไม่ใช่เก็บไว้** — เมื่อผู้ใช้เลือก "เจ้าหน้าที่ชื่อคิว"
 * ใบที่เราไม่รู้ว่าใครรับผิดชอบ (อยู่นอก feed ที่โหลดมา) **ไม่ใช่ใบของคิว**
 * เก็บไว้ = ตัวเลขโป่งเกินจริง · แต่ห้ามตัดเงียบ ต้องคืนยอดที่ตัดออกไปให้จอบอกคนอ่าน
 */

/** ตัวกรองที่ ERP ไม่รู้จัก — ติดตัวใดตัวหนึ่ง = ต้องกรองด้วยรายการเลขที่ใบ */
export type ScopeFilterState = {
  unitFilter: string;
  jobSubtypeFilter: string;
  recruiterFilter: string;
  screenerFilter: string;
  oplFilter: string;
  urgencyFilter: string;
  noteFilter: string;
  ageDaysFilter: string;
  statusFilter: string;
};

/**
 * ต้องกรองด้วยรายการเลขที่ใบไหม
 *
 * ⚠️ **ไม่รวม `departmentFilter`** — BU มากับ throughput อยู่แล้ว
 * (`filterThroughputByDepartment`) กรองซ้ำที่นี่จะทำให้ใบนอก feed หายไปโดยไม่จำเป็น
 */
export function needsRequestScopeFilter(f: ScopeFilterState): boolean {
  return (
    f.unitFilter !== 'all' ||
    f.jobSubtypeFilter !== 'all' ||
    f.recruiterFilter !== 'all' ||
    f.screenerFilter !== 'all' ||
    f.oplFilter !== 'all' ||
    f.urgencyFilter !== 'all' ||
    f.noteFilter !== 'all' ||
    f.ageDaysFilter !== 'all' ||
    f.statusFilter !== 'all'
  );
}

/** เก็บทั้งเลขดิบและเลขที่โชว์ ลง set เดียว — กัน ERP เก็บคนละรูปแบบ */
export function buildRequestKeySet(
  jobs: Array<{ externalId?: string | null; request_no?: string | null; id?: string | null }>,
): Set<string> {
  const set = new Set<string>();
  for (const j of jobs) {
    const ext = (j.externalId || '').trim();
    if (ext) set.add(ext);
    const no = (j.request_no || '').trim();
    if (no) set.add(no);
    // id เต็ม `siamraj-sql:XXX` → เก็บส่วนหลังไว้ด้วย (บางเส้นไม่ได้ตั้ง externalId)
    const id = (j.id || '').trim();
    if (id.startsWith('siamraj-sql:')) set.add(id.slice('siamraj-sql:'.length));
  }
  return set;
}

export type ScopedThroughput = {
  records: ThroughputRecord[];
  /** อัตราที่ถูกตัดออกเพราะระบุใบไม่ได้/ไม่อยู่ในตัวกรอง — ต้องบอกบนจอ ห้ามเงียบ */
  droppedPositions: number;
};

/**
 * @param allowed `null` = ไม่ต้องกรอง (คืนทั้งหมด) · Set = เก็บเฉพาะใบในชุดนี้
 */
export function scopeThroughputByRequestKeys(
  records: ThroughputRecord[],
  allowed: Set<string> | null,
): ScopedThroughput {
  if (!allowed) return { records, droppedPositions: 0 };

  const kept: ThroughputRecord[] = [];
  let droppedPositions = 0;
  for (const r of records) {
    const key = (r.requestNo || '').trim();
    // ไม่มีเลขที่ใบ = ระบุไม่ได้ว่าเป็นของใคร → ตัดออกเมื่อมีตัวกรองระดับใบ
    if (key && allowed.has(key)) kept.push(r);
    else droppedPositions += Number(r.positionUnits) || 0;
  }
  return { records: kept, droppedPositions };
}

/** ข้อความบอกว่ากราฟตัดอะไรออกไป — `null` = ไม่มีอะไรถูกตัด */
export function scopeDropNote(dropped: number): string | null {
  if (dropped <= 0) return null;
  return `กรองตามตัวกรองที่เลือกแล้ว — อีก ${dropped.toLocaleString('th-TH')} อัตราเป็นใบที่อยู่นอกตัวกรอง (หรือระบุผู้รับผิดชอบไม่ได้) จึงไม่ถูกนับ`;
}

/** ผู้รับผิดชอบต่อใบ — มาจาก `/api/siamraj/unit-assignments?all=1` */
export type UnitAssignee = {
  request_no: string;
  recruiter_name: string | null;
  screener_name: string | null;
  opl_name: string | null;
  online_name: string | null;
};

/** ค่าที่ dropdown ใช้แทน "ยังไม่ถูก Assign" — ต้องตรงกับ `matchesRecruiterFilter` ฝั่ง hook */
export const UNASSIGNED_FILTER_VALUE = 'unassigned';

/**
 * เลขที่ใบที่ตรงกับตัวกรองเจ้าหน้าที่ — `null` = ไม่ได้เลือกใคร (ไม่ต้องกรอง)
 *
 * 🔴 ใช้ **ตารางมอบหมายทั้งตาราง** ไม่ใช่ใบใน feed — ใบที่ปิดไปแล้วก็ต้องนับ
 * ไม่งั้นยอดของเจ้าหน้าที่คนนั้นขาดไปทั้งกอง (วัดจริง: คิว 116 ใบ แต่เปิดอยู่ 51)
 *
 * 🔴 "ยังไม่ถูก Assign" ตอบไม่ได้จากตารางนี้ (ใบที่ไม่มีแถว = ไม่ถูกมอบหมาย
 * แต่เราไม่รู้ว่ามีใบอะไรบ้าง) → คืน `null` ให้ผู้เรียกถอยไปใช้ชุดจาก jobs แทน
 */
export function assigneeRequestKeys(
  assignees: UnitAssignee[],
  filters: { recruiterFilter: string; screenerFilter: string; oplFilter: string },
): Set<string> | null {
  const picks: Array<[keyof UnitAssignee, string]> = [];
  if (filters.recruiterFilter !== 'all') picks.push(['recruiter_name', filters.recruiterFilter]);
  if (filters.screenerFilter !== 'all') picks.push(['screener_name', filters.screenerFilter]);
  if (filters.oplFilter !== 'all') picks.push(['opl_name', filters.oplFilter]);
  if (picks.length === 0) return null;
  // ถังพิเศษ "ยังไม่ถูก Assign" ตอบจากตารางนี้ไม่ได้
  if (picks.some(([, v]) => v === UNASSIGNED_FILTER_VALUE)) return null;

  const out = new Set<string>();
  for (const a of assignees) {
    const key = (a.request_no || '').trim();
    if (!key) continue;
    // เลือกหลายบทบาทพร้อมกัน = ต้องตรงทุกบทบาท (เหมือน filterUnitRequests)
    const ok = picks.every(([field, want]) => (a[field] || '').trim() === want.trim());
    if (ok) out.add(key);
  }
  return out;
}
