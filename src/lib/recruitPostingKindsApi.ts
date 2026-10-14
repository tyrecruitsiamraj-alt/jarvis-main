import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import { STANDALONE_POSTING_KINDS, type RecruitPostingKind } from '@/lib/recruitPostings';

/**
 * ประเภทกล่องลอย (เจ้าของสั่ง 14 ต.ค. 2569 "ทำหน้าจัดการประเภทกล่องในตั้งค่าบอร์ด") — `/api/recruit/posting-kinds`
 * ชุดที่เปิดใช้เก็บไว้ที่เดียวในหน้า (`useRecruitPostingKinds`) · แก้จากป๊อปจัดการแล้วเรียก `refreshRecruitPostingKinds()`
 * บอร์ดกับฟอร์ม Gen link เห็นชุดใหม่พร้อมกัน · ยังโหลดไม่เสร็จ/โหลดล้ม = ชุดเริ่ม 5 ประเภท
 */
const FALLBACK: RecruitPostingKind[] = STANDALONE_POSTING_KINDS.map((k, i) => ({
  code: k.code,
  label: k.label,
  sortOrder: (i + 1) * 10,
  isActive: true,
}));

export async function fetchRecruitPostingKinds(opts: { includeInactive?: boolean } = {}): Promise<RecruitPostingKind[]> {
  const r = await apiFetch(`/api/recruit/posting-kinds${opts.includeInactive ? '?all=1' : ''}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดประเภทกล่องไม่สำเร็จ'));
  const data = await readJsonSafe<RecruitPostingKind[]>(r);
  return Array.isArray(data) ? data : [];
}

export async function createRecruitPostingKind(label: string): Promise<RecruitPostingKind> {
  const r = await apiFetch('/api/recruit/posting-kinds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'เพิ่มประเภทกล่องไม่สำเร็จ'));
  return (await readJsonSafe<RecruitPostingKind>(r)) as RecruitPostingKind;
}

export async function updateRecruitPostingKind(
  code: string,
  patch: { label?: string; isActive?: boolean },
): Promise<RecruitPostingKind> {
  const r = await apiFetch('/api/recruit/posting-kinds', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, ...patch }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกประเภทกล่องไม่สำเร็จ'));
  return (await readJsonSafe<RecruitPostingKind>(r)) as RecruitPostingKind;
}

let active: RecruitPostingKind[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(k: RecruitPostingKind[]) => void>();

/** โหลดใหม่ทั้งชุด (รวมที่ปิดแล้ว) แล้วแจ้งทุกจอที่ใช้อยู่ */
export async function refreshRecruitPostingKinds(): Promise<void> {
  loading = fetchRecruitPostingKinds({ includeInactive: true })
    .then((rows) => {
      active = rows;
      for (const fn of listeners) fn(rows);
    })
    .catch(() => {
      // โหลดไม่ได้ = ใช้ชุดเดิมต่อ (ฟอร์มยังสร้างประกาศได้ · API ตรวจซ้ำอีกชั้น)
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/**
 * ประเภทกล่องทั้งหมด (รวมที่ปิดแล้ว · ดู `isActive`) เรียงตามลำดับ — ยังโหลดไม่เสร็จ = ชุดเริ่ม
 * ตัวเลือกตอนสร้างประกาศใช้เฉพาะที่เปิด · บอร์ดยังโชว์กล่องที่ปิดแล้วถ้ายังมีประกาศอยู่
 */
export function useRecruitPostingKinds(): RecruitPostingKind[] {
  const [kinds, setKinds] = useState<RecruitPostingKind[]>(active ?? FALLBACK);
  useEffect(() => {
    listeners.add(setKinds);
    if (active) setKinds(active);
    else if (!loading) void refreshRecruitPostingKinds();
    return () => {
      listeners.delete(setKinds);
    };
  }, []);
  return kinds;
}
