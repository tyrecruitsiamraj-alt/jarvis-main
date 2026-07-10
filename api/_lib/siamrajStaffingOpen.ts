export type StaffingOpenRow = {
  status: string | null;
  is_stop: string | null;
  stop_no: string | null;
  is_inform_all?: string | null;
  request_qty?: number | null;
  inform_qty?: number | null;
  /** จาก SQL — inform_qty หรือนับจาก st_inform_head */
  effective_inform_qty?: number | null;
  has_inform?: number | boolean | null;
};

export function requestPositionTotal(qty: number | null | undefined): number {
  return qty != null && qty > 0 ? qty : 1;
}

export function informedPositionCount(qty: number | null | undefined): number {
  return qty != null && qty > 0 ? qty : 0;
}

/** นับแจ้งเข้าแล้ว — ใช้ inform_qty ก่อน ไม่มีก็ใช้ effective จาก SQL */
export function effectiveInformedCount(row: StaffingOpenRow): number {
  if (row.effective_inform_qty != null && row.effective_inform_qty >= 0) {
    return row.effective_inform_qty;
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
  return row.has_inform === true || row.has_inform === 1;
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
  const isStop = (row.is_stop || '').trim().toUpperCase();
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
