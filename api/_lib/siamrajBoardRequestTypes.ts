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

/**
 * ซ่อน role งานสรรหาภายใน (ลักษณะงาน「ทดแทนงาน / สรรหาทดแทน」) — ไม่ใช่ตำแหน่งจริงของลูกค้า
 * job_description_1 เช่น 139 ทดแทนงาน, 0269 ทดแทน, 235 สรรหาทดแทนงาน, 0176/0177 บริหาร/จัดหาพนักงานทดแทน
 */
export function excludeInternalReplacementRoleWhereSql(alias = 'A'): string {
  return `NOT EXISTS (
    SELECT 1 FROM hr_ms_job_description_1 jd
    WHERE jd.job_description_code_1 = ${alias}.job_description_code_1
      AND jd.job_description_name LIKE N'%ทดแทน%'
  )`;
}

export function isInternalReplacementRoleName(name: string | null | undefined): boolean {
  return /ทดแทน/.test((name || '').trim());
}
