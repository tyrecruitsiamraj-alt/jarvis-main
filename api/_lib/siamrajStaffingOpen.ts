export type StaffingOpenRow = {
  status: string | null;
  is_stop: string | null;
  stop_no: string | null;
  is_inform_all?: string | null;
  request_qty?: number | string | null;
  inform_qty?: number | string | null;
  /** จาก SQL — inform_qty หรือนับจาก st_inform_head (mssql อาจส่งเป็น string) */
  effective_inform_qty?: number | string | null;
  has_inform?: number | boolean | string | null;
};

function toNonNegInt(value: number | string | null | undefined, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

export function requestPositionTotal(qty: number | string | null | undefined): number {
  const n = toNonNegInt(qty, 0);
  return n > 0 ? n : 1;
}

export function informedPositionCount(qty: number | string | null | undefined): number {
  return toNonNegInt(qty, 0);
}

/** นับแจ้งเข้าแล้ว — ใช้ inform_qty ก่อน ไม่มีก็ใช้ effective จาก SQL */
export function effectiveInformedCount(row: StaffingOpenRow): number {
  if (row.effective_inform_qty != null && row.effective_inform_qty !== '') {
    const n = toNonNegInt(row.effective_inform_qty, -1);
    if (n >= 0) return n;
  }
  return informedPositionCount(row.inform_qty);
}

export function remainingOpenPositions(
  requestQty: number | null | undefined,
  informQty: number | null | undefined,
): number {
  return Math.max(requestPositionTotal(requestQty) - informedPositionCount(informQty), 0);
}

export function remainingOpenPositionsFromRow(row: StaffingOpenRow): number {
  return Math.max(requestPositionTotal(row.request_qty) - effectiveInformedCount(row), 0);
}

function hasInformDocument(row: StaffingOpenRow): boolean {
  if (row.has_inform === true || row.has_inform === 1 || row.has_inform === '1') return true;
  if (typeof row.has_inform === 'string' && row.has_inform.trim() !== '') {
    const n = Number(row.has_inform);
    return Number.isFinite(n) && n > 0;
  }
  return false;
}

/** SQL: inform_qty ถ้ามี ไม่งั้นนับจำนวน st_inform_head */
export function effectiveInformQtySql(alias = 'A'): string {
  return `(
    CASE
      WHEN ISNULL(${alias}.inform_qty, 0) > 0 THEN ${alias}.inform_qty
      ELSE (
        SELECT COUNT(*)
        FROM st_inform_head IH
        WHERE IH.request_no = ${alias}.request_no
      )
    END
  )`;
}

/** ใบขอที่ยังต้องหาคน — ไม่มีแจ้งเข้า หรือแจ้งเข้าบางส่วน */
export function isOpenStaffingRow(row: StaffingOpenRow): boolean {
  return isOpenStaffingRowForRemaining(row);
}

export function isOpenStaffingRowForRemaining(row: StaffingOpenRow): boolean {
  const status = (row.status || '').trim().toUpperCase();
  // ค่าว่าง/null = ยังไม่ Stop (open feed เคย omit คอลัมน์นี้แล้วถูกตีเป็นยกเลิกผิด)
  const isStopRaw = (row.is_stop ?? 'N').toString().trim().toUpperCase();
  const isStop = isStopRaw === '' ? 'N' : isStopRaw;
  const stopNo = (row.stop_no || '').trim();
  if (status !== 'A' || isStop !== 'N' || stopNo) return false;

  const informAll = (row.is_inform_all || 'N').trim().toUpperCase();
  if (informAll === 'Y') return false;

  const total = requestPositionTotal(row.request_qty);
  const informed = effectiveInformedCount(row);

  if (!hasInformDocument(row) && informed === 0) return true;
  if (informed > 0 && informed < total) return true;
  return false;
}

export type StaffingPositionBreakdown = {
  requestPositions: number;
  filledPositions: number;
  cancelledPositions: number;
  remainingPositions: number;
};

/** แยกตำแหน่งขอ / หาได้ / ยกเลิก / เหลือ — ห้ามรวมยกเลิกเข้ากับปิดครบ */
export function staffingPositionBreakdown(row: StaffingOpenRow): StaffingPositionBreakdown {
  const requestPositions = requestPositionTotal(row.request_qty);
  const filledPositions = Math.min(effectiveInformedCount(row), requestPositions);
  const isOpen = isOpenStaffingRowForRemaining(row);

  let cancelledPositions = 0;
  if (!isOpen) {
    const unfilled = requestPositions - filledPositions;
    if (filledPositions === 0) {
      cancelledPositions = requestPositions;
    } else if (unfilled > 0) {
      cancelledPositions = unfilled;
    }
  }

  const remainingPositions = Math.max(requestPositions - filledPositions - cancelledPositions, 0);
  return { requestPositions, filledPositions, cancelledPositions, remainingPositions };
}

export function openStaffingRequestWhereSql(alias = 'A'): string {
  const informed = effectiveInformQtySql(alias);
  return `
    ${alias}.status = 'A'
    AND ${alias}.is_stop = 'N'
    AND (${alias}.stop_no IS NULL OR RTRIM(${alias}.stop_no) = '')
    AND ISNULL(${alias}.is_inform_all, 'N') <> 'Y'
    AND (
      NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = ${alias}.request_no)
      OR (
        ${informed} > 0
        AND ${informed} < ISNULL(NULLIF(${alias}.request_qty, 0), 1)
      )
    )
  `.trim();
}
