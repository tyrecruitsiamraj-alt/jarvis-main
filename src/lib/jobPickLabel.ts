import type { JobRequest } from '@/types';
import { jobBoardCardTitle } from './unitRequestDisplay';
import { publicJobTitle } from './publicJobTitle';

/**
 * ป้ายใบขอในช่องเลือก — "ชื่อจุดทำงาน · ตำแหน่ง (เลขที่ใบขอ)" (เดิมอยู่ในป๊อปผู้สมัคร 5 ต.ค. 2569)
 * ใช้ทั้งช่อง "ลงหน่วยงาน" ของนัด และ "ตำแหน่งงานที่สนใจ" ของฟอร์มเพิ่มผู้สมัคร (21 ต.ค. 2569) · เก็บคำนี้ลงประวัตินัดด้วย
 */
export function jobPickLabel(j: JobRequest): string {
  const no = j.request_no?.trim();
  return `${jobBoardCardTitle(j)} · ${publicJobTitle(j)}${no ? ` (${no})` : ''}`;
}

/** คำค้นของใบขอ — ชื่อ/ตำแหน่ง/เลขที่ใบขอ/รหัสไซต์ */
export function jobPickKeywords(j: JobRequest, position: string): string {
  return [j.request_no, j.site_code, j.unit_name, j.work_site_name, position].filter(Boolean).join(' ');
}
