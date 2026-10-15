/** เรียก API หน้าความคุ้มค่า — แยกจากตัวคิด (`valueCase.ts`) ให้ฝั่ง server import ตัวคิดได้ */
import { apiFetch } from "@/lib/apiFetch";
import type { ValueCaseInputs, ValueCaseMonth } from "@/lib/valueCase";

export type ValueCaseResponse = {
  inputs: ValueCaseInputs;
  months: ValueCaseMonth[];
  currentYm: string;
  updatedAt: string | null;
};

export async function fetchValueCase(): Promise<ValueCaseResponse> {
  const r = await apiFetch("/api/value-case");
  if (!r.ok)
    throw new Error(
      r.status === 404 ? "not_allowed" : `โหลดไม่สำเร็จ (${r.status})`,
    );
  return (await r.json()) as ValueCaseResponse;
}

export async function saveValueCase(
  inputs: ValueCaseInputs,
): Promise<{ updatedAt: string }> {
  const r = await apiFetch("/api/value-case", {
    method: "PUT",
    body: JSON.stringify(inputs),
  });
  if (!r.ok) throw new Error(`บันทึกไม่สำเร็จ (${r.status})`);
  return (await r.json()) as { updatedAt: string };
}
