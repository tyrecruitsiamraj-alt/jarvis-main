/**
 * ═══ เพศที่รับ — ใบขอเขียนว่าอะไร · ทีม Online เลือกแล้วหรือยัง ═══
 *
 * เจ้าของเคาะ 26 ก.ย. 2569:
 * > *"ถ้าขึ้น O ให้เลือกได้ว่าจะใส่ว่าเพศอะไรก่อนขึ้นหน้าสาธารณะ"* → Choice: **บังคับเลือกก่อนปล่อย**
 * > ช่องเลือกอยู่ **ขั้น 1 ตรวจใบขอ** ของป๊อปไล่งาน
 *
 * ข้อเท็จจริงจาก ERP (วัด 26 ก.ย. 2569 · ใบขอที่เปิดอยู่): `O` 153 · `M` 103 · `F` 12 · `B` 4
 * ตาราง `ms_sex` มีแค่ F=หญิง · M=ชาย · **O=ไม่ระบุ (Not Specify)** — `B` ไม่มีในตาราง
 * (ฝั่ง API แปลง B เป็น "ไม่ระบุ" อยู่แล้ว · `O` หลุดตารางแปลงจึงโผล่เป็นตัว O ดิบ ๆ บนจอ)
 *
 * 🔴 กติกา:
 * - คำบนจอของ O / B / ว่าง = **"ไม่ระบุ"** (เจ้าของ: โชว์ "ไม่ระบุ" แทน O)
 * - ต้องเลือกก่อนส่งประกาศ = ยังไม่มีค่าที่ทีม Online เลือก **และ** ใบขอไม่ได้บอก ชาย/หญิง
 * - เลือกแล้วเก็บที่ `field_overrides.gender` ช่องเดิม (หน้าจับคู่งานเขียนคีย์นี้อยู่แล้ว ·
 *   feed เอาไปทับ `gender_requirement` ให้ทุกหน้า) — ไม่เพิ่มคอลัมน์ ไม่มี migration
 * - "ไม่จำกัด" = รับทั้งชายและหญิง · ตัวจับคู่ถือว่าไม่มีเงื่อนไขเพศ (เหมือน "ไม่ระบุ" เดิม)
 */
import type { JobRequest } from '@/types';

export const GENDER_CHOICES = ['ชาย', 'หญิง', 'ไม่จำกัด'] as const;
export type GenderChoice = (typeof GENDER_CHOICES)[number];

export type GenderLabel = GenderChoice | 'ไม่ระบุ';

/** แปลงค่าจาก ERP/ที่เก็บ เป็นคำบนจอ — ค่าที่ไม่รู้จักถือเป็น "ไม่ระบุ" (ห้ามเดาความหมาย) */
export function genderLabel(raw: string | null | undefined): GenderLabel {
  const r = (raw ?? '').trim();
  const t = r.toUpperCase();
  if (t === 'M' || t === 'MALE' || r === 'ชาย') return 'ชาย';
  if (t === 'F' || t === 'FEMALE' || r === 'หญิง') return 'หญิง';
  if (r === 'ไม่จำกัด' || t === 'BOTH' || t === 'ANY') return 'ไม่จำกัด';
  return 'ไม่ระบุ';
}

/** ค่าที่ทีม Online เลือกไว้ — ยังไม่เลือก (หรือเก็บค่าแปลก ๆ ไว้) = `null` */
export function onlineGenderChoice(job: Pick<JobRequest, 'field_overrides'>): GenderChoice | null {
  const v = (job.field_overrides?.gender ?? '').trim();
  return (GENDER_CHOICES as readonly string[]).includes(v) ? (v as GenderChoice) : null;
}

/** ใบขอ ERP เขียนว่าอะไร (ก่อนทีม Online เลือกทับ) */
export function erpGenderLabel(
  job: Pick<JobRequest, 'gender_requirement' | 'erp_gender_requirement' | 'field_overrides'>,
): GenderLabel {
  const hasOverride = (job.field_overrides?.gender ?? '').trim() !== '';
  return genderLabel(
    hasOverride && job.erp_gender_requirement !== undefined
      ? job.erp_gender_requirement
      : job.gender_requirement,
  );
}

/**
 * 🔴 ต้องเลือกเพศก่อนส่งประกาศไหม — ทีม Online ยังไม่เลือก และใบขอไม่ได้บอก ชาย/หญิง
 * (ใบขอเขียน "ชาย"/"หญิง" มาแล้ว = ส่งได้เลย แต่ยังแก้ได้ถ้าใบขอมาผิด)
 */
export function genderNeedsChoice(
  job: Pick<JobRequest, 'gender_requirement' | 'erp_gender_requirement' | 'field_overrides'>,
): boolean {
  if (onlineGenderChoice(job)) return false;
  const erp = erpGenderLabel(job);
  return erp !== 'ชาย' && erp !== 'หญิง';
}
