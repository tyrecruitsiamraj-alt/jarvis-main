/**
 * "ดูแลหลังเริ่มงาน" — ฝั่งหน้าเว็บ (Phase 7.2-7.5 · `/api/aftercare`)
 *
 * ⚠️ คีย์คือ **เบอร์** (server แปลงเป็น E.164 ให้) — คนเดียวมีหลายรหัสแต่เบอร์เดียว
 * ⚠️ `migrated: false` = ตารางยังไม่ migrate → หน้าใหม่ต้องเปิดได้และบอกว่ายังว่าง
 * (ห้ามให้จอพังเพราะยังไม่ได้รัน migration)
 */
import { apiFetch } from '@/lib/apiFetch';
import type { AftercareContact, AftercareResult } from '@/lib/aftercareContact';

export type AftercarePerson = {
  phone_e164: string;
  full_name: string;
  unit_name: string | null;
  site_code: string | null;
  /** `YYYY-MM-DD` · null = ยังไม่ระบุวันเริ่มงาน (ห้ามเดาจากวันที่ย้ายเข้ามา) */
  start_date: string | null;
  source: string;
  from_follow_id: string | null;
  note: string | null;
  moved_by_name: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  created_at: string | null;
  /** ผลการโทรดูแลล่าสุด (142 · 10 ต.ค. 2569) — ยังไม่เคยลงผล = null */
  last_contact?: AftercareContact | null;
  contact_count?: number;
};

export type AftercareList = { items: AftercarePerson[]; total: number; migrated?: boolean };

export async function fetchAftercarePeople(includeClosed = false): Promise<AftercareList> {
  const qs = includeClosed ? '?closed=1' : '';
  const r = await apiFetch(`/api/aftercare${qs}`);
  if (!r.ok) throw new Error('โหลดรายชื่อดูแลหลังเริ่มงานไม่สำเร็จ');
  return (await r.json()) as AftercareList;
}

export type MoveToAftercareInput = {
  phone: string;
  full_name: string;
  unit_name?: string | null;
  site_code?: string | null;
  start_date?: string | null;
  from_follow_id?: string | null;
  source?: 'follow_done' | 'manual';
  note?: string | null;
};

/** ย้ายคนเข้ามาดูแล — กดซ้ำได้ (server upsert ต่อเบอร์ · ไม่สร้างซ้ำ) */
export async function moveToAftercare(input: MoveToAftercareInput): Promise<AftercarePerson> {
  const r = await apiFetch('/api/aftercare', { method: 'POST', body: JSON.stringify(input) });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'ย้ายไปดูแลหลังเริ่มงานไม่สำเร็จ');
  }
  return ((await r.json()) as { item: AftercarePerson }).item;
}

export async function updateAftercare(input: {
  phone: string;
  start_date?: string | null;
  unit_name?: string | null;
  site_code?: string | null;
  close?: boolean;
  close_reason?: string | null;
}): Promise<AftercarePerson> {
  const r = await apiFetch('/api/aftercare', { method: 'PATCH', body: JSON.stringify(input) });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'บันทึกไม่สำเร็จ');
  }
  return ((await r.json()) as { item: AftercarePerson }).item;
}

/** ลงผลการโทรดูแล (ทำงานปกติ · มีปัญหา · ลาออก · ติดต่อไม่ได้ + หมายเหตุ) — ทุกครั้งเก็บเป็นประวัติ */
export async function addAftercareContact(input: { phone: string; result: AftercareResult; note?: string | null }): Promise<AftercareContact> {
  const r = await apiFetch('/api/aftercare', { method: 'POST', body: JSON.stringify({ action: 'contact', ...input }) });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'ลงผลไม่สำเร็จ');
  }
  return ((await r.json()) as { item: AftercareContact }).item;
}

export async function fetchAftercareHistory(phone: string): Promise<AftercareContact[]> {
  const r = await apiFetch(`/api/aftercare?history=${encodeURIComponent(phone)}`);
  if (!r.ok) throw new Error('โหลดประวัติการโทรไม่สำเร็จ');
  return ((await r.json()) as { items: AftercareContact[] }).items ?? [];
}
