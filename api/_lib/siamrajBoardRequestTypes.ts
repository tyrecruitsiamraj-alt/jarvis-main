/**
 * ประเภทใบขอที่แสดงบนบอร์ดหน่วยงาน (SQL Server st_ms_request)
 * ไม่รวมงานเสริม/ขยายอัตรา เช่น เปิดไซด์ เพิ่มอัตรา เปลี่ยนคน ทีมเสริม spare ชดแรง ย้าย*
 */
export const BOARD_STAFFING_REQUEST_CODES = ['005', '006', '013', '014'] as const;

export function boardStaffingRequestTypeWhereSql(alias = 'A'): string {
  const codes = BOARD_STAFFING_REQUEST_CODES.map((c) => `'${c}'`).join(', ');
  return `RTRIM(${alias}.request_code) IN (${codes})`;
}

export function isBoardStaffingRequestCode(code: string | null | undefined): boolean {
  const normalized = (code || '').trim();
  return (BOARD_STAFFING_REQUEST_CODES as readonly string[]).includes(normalized);
}
