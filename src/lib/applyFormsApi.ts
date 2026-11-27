import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './apiFetch';
import type { ApplyForm, ApplyFormField } from './applyForms';

/** เส้น `/api/apply-forms` (27 พ.ย. 2569) — พังโยนข้อความไทยจาก server */
async function readError(r: Response): Promise<never> {
  const data = (await r.json().catch(() => ({}))) as { message?: string };
  throw new Error(data.message || `ระบบตอบ ${r.status}`);
}

export async function fetchApplyForms(): Promise<ApplyForm[]> {
  const r = await apiFetch('/api/apply-forms');
  if (!r.ok) return readError(r);
  return ((await r.json()) as { forms: ApplyForm[] }).forms ?? [];
}

export type ApplyFormInput = { name: string; departmentCodes: string[]; fields: ApplyFormField[] };

export async function createApplyForm(input: ApplyFormInput): Promise<ApplyForm> {
  const r = await apiFetch('/api/apply-forms', { method: 'POST', body: JSON.stringify(input) });
  if (!r.ok) return readError(r);
  return ((await r.json()) as { item: ApplyForm }).item;
}

export async function updateApplyForm(id: number, patch: Partial<ApplyFormInput> & { active?: boolean }): Promise<ApplyForm> {
  const r = await apiFetch('/api/apply-forms', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
  if (!r.ok) return readError(r);
  return ((await r.json()) as { item: ApplyForm }).item;
}

export async function deleteApplyForm(id: number): Promise<void> {
  const r = await apiFetch(`/api/apply-forms?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' });
  if (!r.ok) return readError(r);
}

/** รายการฟอร์ม + โหลดใหม่ · อ่านไม่ได้ = รายการว่าง (Gen link ใช้ฟอร์มมาตรฐานได้เสมอ) */
export function useApplyForms(): { forms: ApplyForm[] | null; error: string | null; reload: () => Promise<void> } {
  const [forms, setForms] = useState<ApplyForm[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setForms(await fetchApplyForms());
      setError(null);
    } catch (e) {
      setForms((prev) => prev ?? []);
      setError(e instanceof Error ? e.message : 'โหลดแบบฟอร์มไม่สำเร็จ');
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { forms, error, reload };
}
