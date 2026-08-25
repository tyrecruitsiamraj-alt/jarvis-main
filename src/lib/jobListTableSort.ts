/**
 * เรียงตารางหน้ารายการใบขอด้วยการ**กดหัวคอลัมน์** — ตรรกะล้วน
 *
 * เจ้าของสั่ง 20 ส.ค. 2569: *"ทำเป็นกดเลือกได้ไหมว่าจะเรียงลำดับอันไหน เช่น เรียงจาก
 * มากไปน้อยของใบขอ หรือ อะไรแบบนี้"* + *"เช็คด้วยว่ารันเรียงตามที่เลือกจริงไหม"*
 *
 * 🔴 **ทุกคอลัมน์ที่มีข้อมูลกดเรียงได้หมด** — กดได้บางคอลัมน์ไม่ได้บางคอลัมน์คือของที่
 * เจ้าของเคยทักว่า "ไม่คงที่" (เคสปุ่มบนป๊อปอัปการ์ด 19–20 ส.ค.)
 * 🔴 **ค่าว่างตกท้ายเสมอ** ทั้งขาขึ้นและขาลง — ไม่ใช่ให้ช่องว่างชนะใบที่มีข้อมูลจริง
 */
import type { JobRequest } from '@/types';
import {
  computeJobUrgency,
  getJobRequestAgeDays,
  getJobRequestSubmittedDate,
  isBeforeRequiredForAge,
} from './jobUrgency';
import { publicJobPositionLabel } from './unitRequestDisplay';
import { extractJobSubtypeLabel } from './siamrajUnitFilters';
import { positionBreakdownFromJob } from './requestControl';
import { UNIT_REQUEST_WORK_STATUS_LABELS, isUnitRequestWorkStatus } from './unitRequestWorkStatus';
import { UNIT_SECTOR_LABEL, type UnitSector } from './unitSector';

/** คอลัมน์ที่กดเรียงได้ — เรียงตามลำดับที่โผล่บนตารางจริง */
export const JOB_LIST_TABLE_COLUMNS = [
  'request_no',
  'age',
  'unit',
  'sector',
  'submitted',
  'required',
  'remaining',
  'request_type',
  'position',
  'subtype',
  'resigned',
  'assignee',
  'send_replacement',
  'work_status',
  'note',
] as const;

export type JobListTableColumn = (typeof JOB_LIST_TABLE_COLUMNS)[number];

/** ชื่อคอลัมน์บนจอ — ที่เดียว ใช้ทั้งหัวตารางและป้ายบอกว่ากำลังเรียงจากอะไร */
export const JOB_LIST_TABLE_COLUMN_LABEL: Record<JobListTableColumn, string> = {
  request_no: 'เลขที่ใบขอ',
  age: 'ผ่านมา',
  unit: 'หน่วยงาน',
  sector: 'ราชการ / เอกชน',
  submitted: 'วันที่กรอก',
  required: 'วันที่ต้องการ',
  remaining: 'คงเหลือ',
  request_type: 'ประเภทใบขอ',
  position: 'ตำแหน่ง',
  subtype: 'ลักษณะงานย่อย',
  resigned: 'ผู้ลาออก',
  assignee: 'ผู้รับผิดชอบ',
  send_replacement: 'ส่งคนแทน',
  work_status: 'สถานะทำงาน',
  note: 'หมายเหตุ',
};
export type JobListTableSortDir = 'asc' | 'desc';
export type JobListTableSort = { column: JobListTableColumn; dir: JobListTableSortDir };

const COLUMN_SET = new Set<string>(JOB_LIST_TABLE_COLUMNS);

/** ทิศทางแรกที่ควรได้ตอนกดหัวคอลัมน์ครั้งแรก — ตัวเลข/วันที่เริ่มจากมากไปน้อย ข้อความจาก ก→ฮ */
export function defaultDirForColumn(column: JobListTableColumn): JobListTableSortDir {
  switch (column) {
    case 'age':
    case 'submitted':
    case 'required':
    case 'remaining':
    case 'send_replacement':
      return 'desc';
    default:
      return 'asc';
  }
}

/** อ่าน/เขียนลง URL เป็น `<column>:<dir>` — ต้อง parse แบบไม่เชื่อค่าที่ส่งมา */
export function serializeTableSort(sort: JobListTableSort | null): string | null {
  return sort ? `${sort.column}:${sort.dir}` : null;
}

export function parseTableSort(raw: string | null | undefined): JobListTableSort | null {
  if (!raw) return null;
  const [column, dir] = raw.split(':');
  if (!COLUMN_SET.has(column)) return null;
  if (dir !== 'asc' && dir !== 'desc') return null;
  return { column: column as JobListTableColumn, dir };
}

/** กดหัวคอลัมน์เดิมซ้ำ = สลับทิศ · กดคอลัมน์ใหม่ = เริ่มที่ทิศตั้งต้นของคอลัมน์นั้น */
export function toggleTableSort(
  current: JobListTableSort | null,
  column: JobListTableColumn,
): JobListTableSort {
  if (current && current.column === column) {
    return { column, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { column, dir: defaultDirForColumn(column) };
}

type SortValue = { num?: number; text?: string };

function textVal(v: string | null | undefined): SortValue {
  const t = (v ?? '').trim();
  return t ? { text: t } : {};
}

function ymdVal(v: string | null | undefined): SortValue {
  const t = (v ?? '').trim();
  // ISO/YMD เทียบเป็นข้อความได้ตรงลำดับเวลา — ตัดเวลาออกให้เหลือวัน
  return t ? { text: t.slice(0, 10) } : {};
}

/** ค่าที่ใช้เทียบของแต่ละคอลัมน์ — ว่าง = `{}` (ตกท้ายเสมอ) */
/**
 * ข้อมูลที่ไม่ได้อยู่ใน `JobRequest` แต่ต้องใช้ตอนเรียง
 * (ประเภทหน่วยงานเก็บแยกที่ตาราง `unit_sector` คีย์ site_code — เจ้าของสั่ง 25 ส.ค. 2569)
 */
export type TableSortContext = {
  sectors?: Readonly<Record<string, UnitSector>>;
};

export function tableSortValue(
  job: JobRequest,
  column: JobListTableColumn,
  today = new Date(),
  ctx?: TableSortContext,
): SortValue {
  switch (column) {
    case 'request_no':
      return textVal(job.request_no);
    case 'sector': {
      /**
       * 🔴 "ยังไม่ระบุ" ถือเป็น**ค่าว่าง** → ตกท้ายเสมอทั้งขาขึ้น/ขาลง (กติกาข้อ 2 หัวไฟล์)
       * ถ้าคืนคำว่า "ยังไม่ระบุ" เป็นข้อความ มันจะไปแทรกกลางระหว่างราชการ/เอกชน
       */
      const code = String(job.site_code ?? '').trim();
      const sector = code ? ctx?.sectors?.[code] : undefined;
      return textVal(sector ? UNIT_SECTOR_LABEL[sector] : null);
    }
    case 'age': {
      /**
       * 🔴 **ต้องเรียงตามสิ่งที่ช่องนั้นโชว์** ไม่ใช่ตัวเลขอายุดิบ
       *
       * บั๊กที่เจ้าของเจอ 20 ส.ค. 2569 (*"เรียงมั่วมาก เดี๋ยว 0 เดี๋ยว ล่วงหน้า"*):
       * ใบที่ยังไม่ถึงวันที่ต้องการ ช่องนี้โชว์คำว่า **"ล่วงหน้า"** แต่ `getJobRequestAgeDays`
       * คืน "จำนวนวันนับจากวันที่กรอก" (เช่น 45) → ใบล่วงหน้าไปแทรกกลางระหว่าง
       * `0 วัน` กับ `3 วัน` ทั้งที่บนจอเขียนคำเดียวกันหมด อ่านแล้วเหมือนสุ่ม
       *
       * แก้ด้วยการทำให้เป็น **เส้นเวลาเดียวเทียบวันที่ต้องการ**:
       * ล่วงหน้า = ค่าลบ (ยังไม่ถึงกำหนด · ยิ่งไกลยิ่งลบมาก) → `0` = ถึงกำหนดวันนี้ →
       * บวก = ผ่านมาแล้วกี่วัน · ใบล่วงหน้าจึงเกาะกลุ่มกันปลายเดียวเสมอ
       */
      if (isBeforeRequiredForAge(job, today)) {
        const until = computeJobUrgency(job, today).daysUntilRequired;
        return { num: -1 - Math.max(0, until) };
      }
      const days = getJobRequestAgeDays(job, today);
      return days == null ? {} : { num: days };
    }
    case 'unit':
      return textVal(job.unit_name);
    case 'submitted': {
      const d = getJobRequestSubmittedDate(job);
      return d ? { num: d.getTime() } : {};
    }
    case 'required':
      return ymdVal(job.required_date);
    case 'remaining':
      return { num: positionBreakdownFromJob(job).remainingPositions };
    case 'request_type':
      return textVal(job.request_action_name);
    case 'position':
      return textVal(publicJobPositionLabel(job) || job.staff_title_name);
    case 'subtype':
      return textVal(extractJobSubtypeLabel(job));
    case 'resigned':
      return textVal(job.resigned_employee_name);
    case 'assignee':
      return textVal(job.recruiter_name || job.screener_name || job.opl_name || job.online_name);
    case 'send_replacement':
      // ส่งคนแทน: ส่ง > ไม่ส่ง > ยังไม่ระบุ (ยังไม่ระบุถือเป็นค่าว่าง ตกท้าย)
      return job.send_replacement == null ? {} : { num: job.send_replacement ? 1 : 0 };
    case 'work_status': {
      const raw = (job.work_status ?? '').trim();
      if (!raw) return {};
      return {
        text: isUnitRequestWorkStatus(raw) ? UNIT_REQUEST_WORK_STATUS_LABELS[raw] : raw,
      };
    }
    case 'note':
      return textVal(job.list_note);
    default:
      return {};
  }
}

/**
 * เทียบสองใบตามคอลัมน์ที่เลือก
 * 🔴 ค่าว่างตกท้ายทั้ง asc และ desc · เท่ากันแล้วตัดด้วยเลขที่ใบขอเพื่อให้ลำดับนิ่ง
 * (ไม่นิ่ง = กดหน้า 2 แล้วเห็นใบซ้ำ/หายเพราะ sort ไม่ deterministic)
 */
export function compareJobsByTableColumn(
  a: JobRequest,
  b: JobRequest,
  sort: JobListTableSort,
  today = new Date(),
  ctx?: TableSortContext,
): number {
  const va = tableSortValue(a, sort.column, today, ctx);
  const vb = tableSortValue(b, sort.column, today, ctx);
  const aEmpty = va.num == null && va.text == null;
  const bEmpty = vb.num == null && vb.text == null;
  if (aEmpty && bEmpty) return tieBreak(a, b);
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  let cmp = 0;
  if (va.num != null && vb.num != null) cmp = va.num - vb.num;
  else cmp = (va.text ?? '').localeCompare(vb.text ?? '', 'th', { numeric: true });

  if (cmp === 0) return tieBreak(a, b);
  return sort.dir === 'asc' ? cmp : -cmp;
}

function tieBreak(a: JobRequest, b: JobRequest): number {
  const ka = (a.request_no || a.id || '').trim();
  const kb = (b.request_no || b.id || '').trim();
  return ka.localeCompare(kb, 'th', { numeric: true });
}

export function sortJobsByTableColumn(
  jobs: readonly JobRequest[],
  sort: JobListTableSort,
  today = new Date(),
  ctx?: TableSortContext,
): JobRequest[] {
  return [...jobs].sort((a, b) => compareJobsByTableColumn(a, b, sort, today, ctx));
}
