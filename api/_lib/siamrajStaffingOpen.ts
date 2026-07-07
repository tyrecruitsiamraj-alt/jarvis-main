export type StaffingOpenRow = {
  status: string | null;
  is_stop: string | null;
  stop_no: string | null;
  is_inform_all?: string | null;
  request_qty?: number | null;
  inform_qty?: number | null;
  /** legacy throughput rows */
  has_inform?: number | boolean | null;
};

export function requestPositionTotal(qty: number | null | undefined): number {
  return qty != null && qty > 0 ? qty : 1;
}

export function informedPositionCount(qty: number | null | undefined): number {
  return qty != null && qty > 0 ? qty : 0;
}

export function remainingOpenPositions(
  requestQty: number | null | undefined,
  informQty: number | null | undefined,
): number {
  return Math.max(requestPositionTotal(requestQty) - informedPositionCount(informQty), 0);
}

function hasInformDocument(row: StaffingOpenRow): boolean {
  return row.has_inform === true || row.has_inform === 1;
}

/** ใบขอที่ยังต้องหาคน — ไม่มีแจ้งเข้า หรือแจ้งเข้าบางส่วนที่ inform_qty อัปเดตแล้ว */
export function isOpenStaffingRow(row: StaffingOpenRow): boolean {
  return isOpenStaffingRowForRemaining(row);
}

/** ใบขอที่ยังมีตำแหน่งคงเหลือ */
export function isOpenStaffingRowForRemaining(row: StaffingOpenRow): boolean {
  const status = (row.status || '').trim().toUpperCase();
  const isStop = (row.is_stop || '').trim().toUpperCase();
  const stopNo = (row.stop_no || '').trim();
  if (status !== 'A' || isStop !== 'N' || stopNo) return false;

  const informAll = (row.is_inform_all || 'N').trim().toUpperCase();
  if (informAll === 'Y') return false;

  const total = requestPositionTotal(row.request_qty);
  const informed = informedPositionCount(row.inform_qty);

  if (!hasInformDocument(row) && informed === 0) return true;
  if (informed > 0 && informed < total) return true;
  return false;
}

/** SQL filter — ตรงกับ isOpenStaffingRow (ไม่ดึง inform_qty=0 ที่มี inform แล้ว) */
export function openStaffingRequestWhereSql(alias = 'A'): string {
  return `
    ${alias}.status = 'A'
    AND ${alias}.is_stop = 'N'
    AND (${alias}.stop_no IS NULL OR RTRIM(${alias}.stop_no) = '')
    AND ISNULL(${alias}.is_inform_all, 'N') <> 'Y'
    AND (
      NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = ${alias}.request_no)
      OR (
        ISNULL(${alias}.inform_qty, 0) > 0
        AND ISNULL(${alias}.inform_qty, 0) < ISNULL(NULLIF(${alias}.request_qty, 0), 1)
      )
    )
  `.trim();
}
