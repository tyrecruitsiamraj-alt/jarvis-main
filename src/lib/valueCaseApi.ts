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

/**
 * บัญชีนี้เปิดหน้าความคุ้มค่าได้ไหม — ถามเซิร์ฟเวอร์ครั้งเดียวต่อการโหลดหน้า (ด่านจริงอยู่ที่ API · 404 = ไม่ได้)
 * ใช้ตัดสินว่าเมนู ☰ จะโชว์ทางเข้าไหม (เจ้าของ 15 ต.ค. 2569 "เข้าจากหน้า ui ยังไงหล่ะ")
 */
let accessPromise: Promise<boolean> | null = null;
export function fetchValueCaseAccess(): Promise<boolean> {
  accessPromise ??= apiFetch("/api/value-case?probe=1")
    .then((r) => r.ok)
    .catch(() => {
      accessPromise = null;
      return false;
    });
  return accessPromise;
}
