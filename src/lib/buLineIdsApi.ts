import React from 'react';
import { apiFetch } from './apiFetch';
import type { BuLineIds } from './buLineIds';

/** แอดไลน์ประจำ BU (13 พ.ย. 2569) — อ่านครั้งเดียวต่อการเปิดหน้า (ค่าไม่ค่อยเปลี่ยน) · บันทึกแล้วล้างสำเนา */
let cached: Promise<BuLineIds> | null = null;

async function readError(r: Response): Promise<never> {
  const data = (await r.json().catch(() => ({}))) as { message?: string };
  throw new Error(data.message || `ระบบตอบ ${r.status}`);
}

export function fetchBuLineIds(fresh = false): Promise<BuLineIds> {
  if (!cached || fresh) {
    cached = apiFetch('/api/bu-line-ids')
      .then(async (r) => (r.ok ? ((await r.json()) as { ids: BuLineIds }).ids : readError(r)))
      .catch((e: unknown) => {
        cached = null;
        throw e;
      });
  }
  return cached;
}

export async function saveBuLineId(bu: string, lineId: string): Promise<BuLineIds> {
  const r = await apiFetch('/api/bu-line-ids', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bu, lineId }) });
  if (!r.ok) return readError(r);
  const ids = ((await r.json()) as { ids: BuLineIds }).ids;
  cached = Promise.resolve(ids);
  return ids;
}

/** ID LINE ของ BU นี้ · ยังโหลดไม่มา/ไม่ได้ตั้ง/อ่านไม่ได้ = null (ไม่มีบรรทัดแอดไลน์) */
export function useBuLineId(bu: string | null): string | null {
  const [ids, setIds] = React.useState<BuLineIds | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetchBuLineIds()
      .then((v) => alive && setIds(v))
      .catch(() => alive && setIds(null));
    return () => {
      alive = false;
    };
  }, []);
  return bu && ids ? (ids[bu] ?? null) : null;
}
