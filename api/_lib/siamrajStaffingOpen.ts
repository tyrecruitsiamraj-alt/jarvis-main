/** ตำแหน่งที่ขอทั้งหมด — default 1 ถ้าไม่ระบุ */
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

/** ใบขอที่ยังต้องหาคน — รวมกรณีแจ้งเข้าบางส่วน (inform_qty < request_qty) */
export function openStaffingRequestWhereSql(alias = 'A'): string {
  return `
    ${alias}.status = 'A'
    AND ${alias}.is_stop = 'N'
    AND (${alias}.stop_no IS NULL OR RTRIM(${alias}.stop_no) = '')
    AND ISNULL(${alias}.inform_qty, 0) < ISNULL(NULLIF(${alias}.request_qty, 0), 1)
  `.trim();
}

/** ใบขอที่ยังต้องหาคน — ตรงกับ feed หลัก */
export function isOpenStaffingRow(row: {
  status: string | null;
  is_stop: string | null;
  stop_no: string | null;
  request_qty?: number | null;
  inform_qty?: number | null;
  has_inform?: number | boolean | null;
}): boolean {
  const status = (row.status || '').trim().toUpperCase();
  const isStop = (row.is_stop || '').trim().toUpperCase();
  const stopNo = (row.stop_no || '').trim();
  if (status !== 'A' || isStop !== 'N' || stopNo) return false;
  if (row.request_qty !== undefined || row.inform_qty !== undefined) {
    return remainingOpenPositions(row.request_qty, row.inform_qty) > 0;
  }
  const hasInform = row.has_inform === true || row.has_inform === 1;
  return !hasInform;
}
