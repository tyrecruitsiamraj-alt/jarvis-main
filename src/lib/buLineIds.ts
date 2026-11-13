/**
 * ═══ แอดไลน์ประจำ BU (เจ้าของ 13 พ.ย. 2569 "ในแคปชั่นต้องใส่ id line ด้วย" · Choice "ID LINE กลางของบริษัท แต่แยก Bu") ═══
 * pure ใช้ร่วม server/จอ/เทสต์ — ตั้งที่ ตั้งค่า › แอดไลน์ประจำ BU · บรรทัดในข้อความประกาศ = "แอดไลน์ : xxx" (คำของเจ้าของ)
 * BU ของใบ = `jobBuOf` (ไซต์ก่อน แผนกทีหลัง) · ใบที่ BU ไม่ได้ตั้ง = ไม่มีบรรทัด
 */
import { APP_DEPARTMENT_CODES } from '@/lib/departmentCodes';

export const BU_LINE_ID_MAX = 50;
/** ID LINE ใช้ได้: ตัวอักษร ตัวเลข . _ - และ @ หน้าสุด (บัญชีทางการ) */
const LINE_ID_RE = /^@?[A-Za-z0-9._-]{1,49}$/;

export type BuLineIds = Record<string, string>;

/** ค่าที่พิมพ์มา → ID ที่เก็บ · ว่าง = null (ลบ) · รูปแบบผิด = 'invalid' */
export function normalizeLineId(raw: unknown): string | null | 'invalid' {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return null;
  return v.length <= BU_LINE_ID_MAX && LINE_ID_RE.test(v) ? v : 'invalid';
}

export const isLineBu = (bu: string): boolean => (APP_DEPARTMENT_CODES as readonly string[]).includes(bu);

export const lineIdCaptionLine = (id: string): string => `แอดไลน์ : ${id}`;
