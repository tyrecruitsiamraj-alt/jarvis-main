import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type { JobRequest } from '@/types';

export type SiamrajFeedMeta = {
  enabled: boolean;
  dbSource?: 'postgres' | 'sqlserver' | null;
  // ไม่รับ host/database/schema ของ DB มาฝั่ง client อีกต่อไป (กันหลุด infra) — ใช้แค่ boolean
  sqlServerConfigured?: boolean;
  readOnly: boolean;
  mode: string;
};

export async function fetchSiamrajFeedMeta(): Promise<SiamrajFeedMeta> {
  const r = await apiFetch('/api/siamraj/unit-requests?meta=1', { cache: 'no-store' });
  if (!r.ok) {
    return { enabled: false, readOnly: true, mode: 'staffing_queue' };
  }
  return readJsonSafe<SiamrajFeedMeta>(r);
}

export async function fetchSiamrajUnitRequests(limit = 200): Promise<JobRequest[]> {
  const r = await apiFetch(`/api/siamraj/unit-requests?limit=${limit}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดใบขอจาก Siamraj ไม่สำเร็จ'));
  return readJsonSafe<JobRequest[]>(r);
}

export async function fetchSiamrajUnitRequest(id: string): Promise<JobRequest> {
  const r = await apiFetch(`/api/siamraj/unit-requests?id=${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดรายละเอียดใบขอไม่สำเร็จ'));
  return readJsonSafe<JobRequest>(r);
}

export type SiamrajThroughputRecord = {
  /** เลขที่ใบขอ**ดิบ** — คีย์จัดกลุ่ม ห้ามตัดนำหน้าทิ้ง */
  requestNo?: string;
  /** id เต็มของใบขอ (`siamraj-sql:<เลขดิบ>`) — ใช้เปิดใบจาก drill-down */
  jobId?: string;
  /** เลขที่ใบขอแบบที่โชว์บนจอ */
  requestNoDisplay?: string;
  unitName?: string;
  siteCode?: string;
  requiredDate?: string | null;
  leadKind?: 'retroactive' | 'urgent' | 'advance';
  /** รหัส BU ของไซต์ — ใช้กรอง KPI เข้ามา/ปิด/ยกเลิก ตาม BU ที่เลือก */
  departmentCode?: string;
  requestDate: string;
  closureDate: string | null;
  positionUnits: number;
  isOpen: boolean;
  kind?: 'filled' | 'cancelled' | 'remaining';
  requestActionName?: string;
  requestActionCode?: string;
  lifecycleKind?: 'resignation' | 'replacement' | 'increase_headcount' | 'new_site' | 'other';
};

export async function fetchSiamrajThroughput(from: string, to: string): Promise<SiamrajThroughputRecord[]> {
  const params = new URLSearchParams({ throughput: '1', from, to });
  const r = await apiFetch(`/api/siamraj/unit-requests?${params}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดสถิติขอ/ปิดไม่สำเร็จ'));
  const data = await readJsonSafe<SiamrajThroughputRecord[]>(r);
  return Array.isArray(data) ? data : [];
}

/** รายการใบขอที่ปิด/แจ้งเข้าในช่วง — สำหรับ drill-down การ์ด "ปิดใบขอ" (position_units = จำนวนที่ปิด) */
export async function fetchSiamrajClosedRequests(from: string, to: string): Promise<JobRequest[]> {
  const params = new URLSearchParams({ closed: '1', from, to });
  const r = await apiFetch(`/api/siamraj/unit-requests?${params}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดรายการใบขอที่ปิดไม่สำเร็จ'));
  const data = await readJsonSafe<JobRequest[]>(r);
  return Array.isArray(data) ? data : [];
}

/** บันทึกผู้รับผิดชอบ (สรรหา/คัดสรร) ของใบขอ Siamraj — เก็บใน PostgreSQL ฝั่ง Jarvis */
export async function saveSiamrajUnitAssignment(
  requestNo: string,
  payload: { recruiter_name?: string | null; screener_name?: string | null; opl_name?: string | null },
): Promise<void> {
  const r = await apiFetch('/api/siamraj/unit-assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_no: requestNo, ...payload }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกผู้รับผิดชอบไม่สำเร็จ'));
}

export async function fetchUnitNoteHistory(limit = 50): Promise<string[]> {
  const r = await apiFetch(`/api/siamraj/unit-notes?history=1&limit=${limit}`, { cache: 'no-store' });
  if (!r.ok) return [];
  const data = await readJsonSafe<{ items?: string[] }>(r);
  return Array.isArray(data.items) ? data.items : [];
}

export async function saveUnitRequestNote(requestNo: string, note: string): Promise<void> {
  await saveUnitRequestMeta(requestNo, { note: note.trim() || null });
}

export type UnitBranchOverride = {
  branch_id?: string;
  branch_name_clean: string;
  address_raw?: string | null;
  road?: string | null;
  subdistrict?: string | null;
  requested_qty: number;
  district_hint: string | null;
  province_hint: string | null;
  postal_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  geocode_status?: 'unverified' | 'estimated' | 'confirmed' | 'not_found';
};
export type UnitFieldOverrides = {
  age_min?: number | null;
  age_max?: number | null;
  gender?: string | null;
  branches?: UnitBranchOverride[] | null;
  /**
   * ค่าที่เจ้าหน้าที่แก้เองเพื่อให้ประกาศสาธารณะถูกต้อง (17 ส.ค. 2569)
   * null = กลับไปใช้ค่าจาก ERP · ต้องตรงกับ `UnitFieldOverrides` ฝั่ง API
   * (`api/_lib/siamrajUnitNotes.ts`) ไม่งั้น sanitizer ตัดทิ้งเงียบ
   */
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  total_income?: number | null;
  benefits?: string[] | null;
};

export async function saveUnitRequestMeta(
  requestNo: string,
  payload: {
    note?: string | null;
    send_replacement?: boolean | null;
    parser_override_text?: string | null;
    field_overrides?: UnitFieldOverrides | null;
  },
): Promise<void> {
  const r = await apiFetch('/api/siamraj/unit-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_no: requestNo, ...payload }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกข้อมูลใบขอไม่สำเร็จ'));
}

export type UnitWorkStatusPersonPayload = {
  first_name: string;
  last_name: string;
  status_date?: string | null;
};

export type UnitWorkStatusPayload = {
  status: string;
  persons?: UnitWorkStatusPersonPayload[];
  person_first_name?: string | null;
  person_last_name?: string | null;
  status_date?: string | null;
};

export type UnitWorkStatusRecord = UnitWorkStatusPayload & {
  request_no: string;
  persons?: UnitWorkStatusPersonPayload[];
  updated_at: string | null;
};

export async function saveUnitRequestWorkStatus(
  requestNo: string,
  payload: UnitWorkStatusPayload,
): Promise<UnitWorkStatusRecord> {
  const r = await apiFetch('/api/siamraj/unit-work-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_no: requestNo, ...payload }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกสถานะทำงานไม่สำเร็จ'));
  return readJsonSafe<UnitWorkStatusRecord>(r);
}

export function unitRequestNoteKey(job: JobRequest): string {
  return (job.externalId || job.request_no || job.id).trim();
}

export function isSiamrajJob(job: JobRequest): boolean {
  return (
    job.source === 'siamraj' ||
    job.id.startsWith('siamraj:') ||
    job.id.startsWith('siamraj-sql:') ||
    // ใบขอล่วงหน้า (17 ส.ค. 2569) — ไม่รู้จัก prefix นี้ = ลิงก์เปิดใบพาไป /jobs/<id> ซึ่งไม่มีหน้า
    job.id.startsWith('siamraj-pre:')
  );
}

export function siamrajExternalId(job: JobRequest): string | null {
  if (job.externalId) return job.externalId;
  if (job.id.startsWith('siamraj-sql:')) return job.id.slice('siamraj-sql:'.length);
  if (job.id.startsWith('siamraj-pre:')) return job.id.slice('siamraj-pre:'.length);
  if (job.id.startsWith('siamraj:')) return job.id.slice('siamraj:'.length);
  return null;
}

/** ผู้รับผิดชอบของ **ทุกใบ** — Dashboard ใช้กรองกราฟ/การ์ดตามเจ้าหน้าที่ (18 ส.ค. 2569) */
export async function fetchAllUnitAssignees(): Promise<
  Array<{
    request_no: string;
    recruiter_name: string | null;
    screener_name: string | null;
    opl_name: string | null;
    online_name: string | null;
  }>
> {
  const r = await apiFetch('/api/siamraj/unit-assignments?all=1', { cache: 'no-store' });
  if (!r.ok) return [];
  const data = await readJsonSafe<{ items?: Array<{ request_no: string; recruiter_name: string | null; screener_name: string | null; opl_name: string | null; online_name: string | null }> }>(r);
  return Array.isArray(data.items) ? data.items : [];
}

/**
 * ประวัติ "ใครแก้อะไรไป" ของใบขอ (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ)
 * อ่านจาก audit_logs ผ่านเส้น scoped — โหลดพัง = คืน [] (ประวัติล้มห้ามพาหน้าหลักล้ม)
 */
export async function fetchUnitEditLog(
  requestNo: string,
): Promise<import('@/lib/unitEditLog').UnitEditLogItem[]> {
  const r = await apiFetch(
    `/api/siamraj/unit-history?request_no=${encodeURIComponent(requestNo)}`,
    { cache: 'no-store' },
  );
  if (!r.ok) throw new Error(`โหลดประวัติไม่สำเร็จ (HTTP ${r.status})`);
  const data = await readJsonSafe<{ items?: import('@/lib/unitEditLog').UnitEditLogItem[] }>(r);
  return Array.isArray(data.items) ? data.items : [];
}

/**
 * รายชื่อ **หน่วยงานทั้งชุด** (ตั้งแต่ปี 2567) — กล่องเลือกหน่วยงานของหน้า Follow
 * เจ้าของแจ้ง 18 ส.ค. 2569 ว่ากล่องเดิมขึ้นไม่ครบเพราะยุบมาจากใบขอที่ยังเปิดเท่านั้น
 * โหลดพัง = คืน [] แล้วกล่องถอยไปใช้ชุดจากใบขอเปิดเหมือนเดิม (ห้ามบล็อกงาน)
 */
export async function fetchAllUnitOptions(): Promise<import('@/lib/boardUnitPicker').BoardUnitOption[]> {
  const r = await apiFetch('/api/siamraj/unit-requests?units=1', { cache: 'no-store' });
  if (!r.ok) return [];
  const data = await readJsonSafe<{
    items?: Array<{
      siteCode: string;
      unitName: string;
      openRequests: number;
      totalRequests: number;
      lastRequestDate: string | null;
      sampleRequestNo: string | null;
    }>;
  }>(r);
  return (data.items ?? []).map((u) => ({
    siteCode: u.siteCode,
    unitName: u.unitName,
    openRequests: Number(u.openRequests) || 0,
    // ชุดนี้ไม่มีรายละเอียดอัตรา/ตำแหน่ง — ตัวที่มีใบขอเปิดจะถูกทับด้วยชุดละเอียดตอน merge
    remainingPositions: 0,
    sampleRequestNo: u.sampleRequestNo,
    roles: [],
    totalRequests: Number(u.totalRequests) || 0,
    lastRequestDate: u.lastRequestDate,
  }));
}
