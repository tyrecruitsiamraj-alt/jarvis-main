/**
 * ข้อความบอกเหตุผลตอนเปิด/แก้ใบขอไม่ได้
 *
 * 🔴 **เดิมเหมารวมทุกกรณีเป็น "ไม่มีสิทธิ์เข้าถึงใบขอของแผนกอื่น"** ซึ่งบอกผิดสาเหตุ
 * (เจ้าของเจอจริง 18 ส.ค. 2569: `samtipap` เป็น supervisor **LBD** เปิดใบ `OPL6901006`
 * ซึ่งไซต์ก็อยู่ **LBD** — แผนกตรงกันเป๊ะ แต่ใบนั้น**ปิดไปแล้ว** ด่านจึงหาไม่เจอ
 * แล้วตีความว่าเป็นใบของแผนกอื่น) → ไล่ปัญหาไม่ถูกจุดอยู่หลายรอบ
 *
 * แยกให้ชัดว่าเป็นคนละเรื่อง: ไม่พบใบ / อยู่ BU อื่นจริง / ยังไม่ได้ตั้งแผนกให้ผู้ใช้
 */

export type RequestScopeDenyReason = 'not_found' | 'other_bu' | 'no_department';

export type RequestScopeDeny = {
  reason: RequestScopeDenyReason;
  /** BU ของใบ (รู้เฉพาะกรณี other_bu) */
  requestBu?: string | null;
  /** BU ของผู้ใช้ */
  userBu?: string | null;
  /** เลขที่ใบที่ผู้ใช้กดมา — ใช้เตือนเรื่องเลขนำหน้าไม่ใช่ BU */
  requestNo?: string | null;
};

/**
 * 🔴 **เลขนำหน้าใบขอ = รหัสแผนกที่ยื่นขอ ไม่ใช่ BU ของไซต์** — คนอ่านเลขแล้วเข้าใจผิดประจำ
 * (OPL/LBM/SQ/PEO → LBD · LAO/LAM → LBA · DSO → DS · LMO → LM)
 * ข้อความจึงต้องเขียนให้ครบ ไม่ใช่บอกแค่ว่า "แผนกอื่น"
 */
export function requestScopeDenyMessage(deny: RequestScopeDeny): string {
  switch (deny.reason) {
    case 'no_department':
      return 'บัญชีนี้ยังไม่ได้ตั้งแผนก (BU) — ให้ผู้ดูแลระบบตั้งแผนกให้ก่อนถึงจะเปิดใบขอได้';

    case 'other_bu': {
      const req = (deny.requestBu || '').trim() || 'ไม่ทราบ';
      const mine = (deny.userBu || '').trim() || 'ไม่ทราบ';
      const no = (deny.requestNo || '').trim();
      const prefixHint = no
        ? ` · เลขนำหน้าใบ (${no.replace(/\d+$/, '') || no}) คือรหัสแผนกที่ยื่นขอ ไม่ใช่ BU`
        : '';
      return `ใบนี้อยู่ BU ${req} แต่บัญชีคุณอยู่ BU ${mine} จึงแก้ไม่ได้${prefixHint}`;
    }

    case 'not_found':
    default:
      return 'ไม่พบใบขอนี้ในระบบ (เลขที่ใบอาจพิมพ์ผิด หรือถูกลบออกจาก ERP แล้ว)';
  }
}
