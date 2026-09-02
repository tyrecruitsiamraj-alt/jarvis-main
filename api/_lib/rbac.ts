import type { UserRole } from './auth.js';

/** Role hierarchy — backend source of truth (admin > supervisor > staff > opl). */
export const ROLE_LEVEL: Record<UserRole, number> = {
  admin: 4,
  supervisor: 3,
  staff: 2,
  opl: 1,
};

export function isReadOnlyRole(role: UserRole): boolean {
  return role === 'opl';
}

export function meetsMinimumRole(userRole: UserRole, minimum: UserRole): boolean {
  if (userRole === 'opl') {
    // OPL = read-only viewer: only pass routes/APIs whose minimum is staff or opl
    return minimum === 'staff' || minimum === 'opl';
  }
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minimum];
}

export type ApiResource =
  | 'candidates'
  | 'jobs'
  | 'employees'
  | 'clients'
  | 'work-calendar'
  | 'job-assignments'
  | 'candidate-interviews'
  | 'candidate-work-history'
  | 'training-records'
  | 'follow'
  | 'follow-staff-contacts'
  | 'follow-topics'
  | 'job-staff'
  | 'app-users'
  | 'app-nav-preferences'
  | 'audit-logs'
  /** สถานะระบบ (ยามเฝ้า) — ตกไป default = admin เท่านั้น */
  | 'system-health'
  | 'branding'
  | 'siamraj-unit-requests'
  | 'siamraj-unit-assignments'
  | 'siamraj-unit-notes'
  | 'siamraj-unit-history'
  | 'siamraj-unit-work-status'
  | 'siamraj-opl-import'
  | 'recruit-registrations'
  | 'recruit-funnel'
  | 'matching-suggestions'
  | 'matching-parse-branch-demand'
  | 'matching-candidate-spec'
  | 'matching-irecruit-candidates'
  | 'matching-recruit-lane'
  | 'matching-selection-recall'
  | 'matching-board-candidates'
  | 'matching-proposals'
  | 'matching-job-postings'
  | 'matching-flow-summary'
  | 'lumos-dispatch'
  | 'job-applications'
  | 'work-status-master'
  | 'recruit-channels'
  | 'recruit-reasons'
  | 'recruit-job-titles'
  | 'recruit-postings';

/**
 * Minimum role per API resource and HTTP method.
 * Fine-grained hints refine write permissions per resource.
 */
export function minimumRoleFor(
  resource: ApiResource,
  method: string,
  hint?: string,
): UserRole {
  const m = method.toUpperCase();
  const isRead = m === 'GET' || m === 'HEAD';

  switch (resource) {
    case 'candidates':
      // staff: create/read; supervisor+: update/archive
      if (isRead || m === 'POST') return 'staff';
      return 'supervisor';

    case 'jobs':
      // staff: read only; supervisor+: create/update/archive
      if (isRead) return 'staff';
      return 'supervisor';

    case 'employees':
      // staff: read; supervisor+: create/update
      if (isRead) return 'staff';
      return 'supervisor';

    case 'clients':
      // staff: read; supervisor+: create/update/delete; settings ไม่เกี่ยว
      if (isRead) return 'staff';
      return 'supervisor';

    case 'work-calendar':
      // staff: read + create entries; supervisor+: manage team calendar
      if (isRead || m === 'POST') return 'staff';
      return 'supervisor';

    case 'job-assignments':
    case 'training-records':
      if (isRead) return 'staff';
      return 'supervisor';

    case 'candidate-interviews':
    case 'candidate-work-history':
      if (isRead || m === 'POST') return 'staff';
      return 'supervisor';

    case 'follow':
      // staff: ดู + เพิ่ม/ยกเลิกรายชื่อที่ต้องติดตามเอง
      return 'staff';

    case 'follow-staff-contacts':
    case 'follow-topics':
      // อ่านได้ทุกคน (dropdown เบอร์เจ้าหน้าที่ / เรื่องที่จะให้โทรติดตาม บนหน้า Follow ใช้)
      // เพิ่มค่าใหม่เฉพาะหัวหน้างานขึ้นไป (เจ้าของสั่ง 18 ส.ค. 2569)
      if (isRead) return 'staff';
      return 'supervisor';

    case 'job-staff':
      if (isRead) return 'staff';
      return 'supervisor';

    case 'app-users':
    case 'audit-logs':
    case 'branding':
      return 'admin';

    case 'app-nav-preferences':
      // อ่านได้ทุกคน (ทุกหน้าต้องใช้ตอน render เมนู) · เขียนเฉพาะ admin
      if (isRead) return 'staff';
      return 'admin';

    case 'recruit-channels':
      /**
       * อ่าน/เขียนได้ตั้งแต่ staff (เจ้าของสั่ง 2 ก.ย. 2569:
       * *"เพิ่มช่องทางหลัก ทางรอง ลบช่องทางหลัก ช่องทางรอง ทำให้ Staff เข้าถึงได้ด้วย"*)
       *
       * ⚠️ ต่างจาก `recruit-postings` (ปล่อยประกาศขึ้นหน้าสาธารณะ) โดยตั้งใจ —
       * ช่องทางเป็นข้อมูลอ้างอิงในบ้าน แก้ผิดแล้วแก้กลับได้ ไม่มีใครนอกองค์กรเห็น
       * · ชั้นที่สองอยู่ที่ฟังก์ชัน `recruit_channels_manage` ซึ่ง admin ปิดรายบทบาทได้
       */
      return 'staff';

    case 'recruit-reasons':
      /**
       * อ่าน/แก้ได้ตั้งแต่ staff (เจ้าของสั่ง 2 ก.ย. 2569: *"Staff ก็ทำได้ แก้เลย"*)
       * — เหตุผลที่ผู้สมัครปฏิเสธเป็นข้อมูลอ้างอิงในบ้าน แก้ผิดแล้วแก้กลับได้
       */
      return 'staff';

    case 'recruit-job-titles':
      // อ่านได้ทุกคน (ช่องตำแหน่งงานในฟอร์มเพิ่มผู้สมัคร/สร้างลิงก์ใช้)
      // ⚠️ ยังไม่มีทางเขียน — handler ตอบ 405 อยู่แล้ว แต่ตั้ง admin ไว้เป็นชั้นที่สอง
      // เผื่อวันหน้ามีคนเพิ่ม POST เข้าไปโดยไม่ได้กลับมาดูตารางสิทธิ์นี้
      if (isRead) return 'staff';
      return 'admin';

    case 'recruit-postings':
      return 'staff';

    case 'work-status-master':
      // อ่านได้ทุกคน (dropdown สถานะทำงานทั้งระบบใช้) — เพิ่ม/แก้/ลบเฉพาะ admin
      if (isRead) return 'staff';
      return 'admin';

    case 'siamraj-unit-requests':
      return 'staff';

    case 'siamraj-unit-assignments':
      if (isRead) return 'staff';
      return 'supervisor';

    case 'siamraj-unit-notes':
      return 'staff';

    case 'siamraj-unit-history':
      // ประวัติ "ใครแก้อะไร" ของใบขอ — อ่านอย่างเดียว (handler ตอบ 405 ที่เหลือ)
      // ตั้ง admin เป็นชั้นสองไว้เผื่อวันหน้ามีคนเพิ่ม POST โดยไม่กลับมาดูตารางนี้
      if (isRead) return 'staff';
      return 'admin';

    case 'siamraj-unit-work-status':
      return 'staff';

    case 'siamraj-opl-import':
      return 'admin';

    // `matching-recruit-lane` = เลนสรรหา — ระดับเดียวกับเลนคัดสรร (staff)
    // A4 จะมาแยกทีมสรรหา/คัดสรรด้วย function grant ไม่ใช่ที่ระดับ role ตรงนี้
    case 'recruit-funnel':
    case 'recruit-registrations':
    case 'matching-suggestions':
    case 'matching-parse-branch-demand':
    case 'matching-candidate-spec':
    case 'matching-irecruit-candidates':
    case 'matching-recruit-lane':
    case 'matching-selection-recall':
    case 'matching-board-candidates':
    case 'matching-proposals':
    case 'matching-job-postings':
    case 'matching-flow-summary':
      return 'staff';

    case 'lumos-dispatch':
      // staff: ดูผลการโทร + ติ๊กเลือกส่งให้ Lumos โทรเอง (โมเดลเดียวกับ follow)
      // opl ถูกกันที่ checkApiAccess อยู่แล้ว (read-only role ห้าม POST/DELETE)
      return 'staff';

    case 'job-applications':
      // recruiter pipeline: staff read applicants and update their status/note
      return 'staff';

    default:
      return 'admin';
  }
}

export function checkApiAccess(
  userRole: UserRole,
  resource: ApiResource,
  method: string,
  hint?: string,
): { ok: true } | { ok: false; message: string } {
  const m = method.toUpperCase();
  const isRead = m === 'GET' || m === 'HEAD';

  if (isReadOnlyRole(userRole) && !isRead) {
    return { ok: false, message: 'Read-only role (opl)' };
  }

  const minimum = minimumRoleFor(resource, method, hint);
  if (!meetsMinimumRole(userRole, minimum)) {
    return {
      ok: false,
      message: `Requires ${minimum} role or higher`,
    };
  }
  return { ok: true };
}
