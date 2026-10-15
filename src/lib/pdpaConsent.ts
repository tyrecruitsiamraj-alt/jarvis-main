/**
 * ═══ ข้อความยินยอม PDPA — ที่เดียวของทั้งระบบ (เจ้าของ 15 ต.ค. 2569) ═══
 * Choice "ทำช่องยินยอม รอข้อความจากบริษัท" — ข้อความด้านล่างเป็น **ฉบับชั่วคราว** รอฝ่ายกฎหมาย/HR ส่งของจริง
 * ได้ข้อความจริงแล้ว: แก้ `PDPA_CONSENT_TEXT_*` + ใส่ `PDPA_POLICY_URL` + เปลี่ยน `PDPA_CONSENT_VERSION`
 * (ใบที่ยินยอมไปแล้วเก็บ version เดิมไว้ — ย้อนดูได้ว่าใครยินยอมฉบับไหน · ตาราง `app_application_consents` · 148)
 */

export const PDPA_CONSENT_VERSION = 'draft-2569-10-15';

/** ลิงก์นโยบายความเป็นส่วนตัวของบริษัท — `null` = ยังไม่มี (ไม่ขึ้นลิงก์) */
export const PDPA_POLICY_URL: string | null = null;

/** ผู้สมัครติ๊กเองบนหน้าสมัคร */
export const PDPA_CONSENT_TEXT_APPLICANT =
  'ยินยอมให้สยามราชธานีเก็บและใช้ข้อมูลนี้เพื่อพิจารณางาน และโทรติดต่อกลับ (รวมถึงระบบโทรอัตโนมัติ)';

/** เจ้าหน้าที่คีย์ใบเอง / นำเข้า Excel — ยืนยันว่าผู้สมัครยินยอมแล้ว */
export const PDPA_CONSENT_TEXT_STAFF = 'ผู้สมัครยินยอมให้เก็บข้อมูลและโทรติดต่อกลับแล้ว';

export const PDPA_CONSENT_REQUIRED_MESSAGE = 'กรุณาติ๊กยินยอมก่อน';

export type PdpaConsentSource = 'apply' | 'staff' | 'import';
