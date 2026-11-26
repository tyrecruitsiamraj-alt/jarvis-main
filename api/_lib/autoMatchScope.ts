/**
 * ═══ ใบไหนระบบจับคู่ให้เอง (เจ้าของ 26 พ.ย. 2569) ═══
 * > *"ส่วนใบอื่นนอกจากดำเนินการสรรหา ไม่ match ให้เองต้องเข้าไปกด สั่ง match เอง"*
 *
 * จับคู่ให้เอง (ตัวคิดหลังบ้าน · เปิดใบดูครั้งแรก) = เฉพาะใบสถานะทำงาน "ดำเนินการ" (`in_progress` · ไม่มีแถวสถานะ = ดำเนินการ
 * ตามจอกล่องงาน `resolveUnitRequestWorkStatus`) · สถานะอื่น (ชะลอ · รอแจ้งเข้า · รอเริ่มงาน …) = ต้องกด "ค้นหาใหม่" เอง
 * อ่านสถานะไม่ได้ = ไม่จับคู่ให้เอง (คนยังกดเองได้)
 */
import { getUnitWorkStatusMap } from './siamrajUnitWorkStatus.js';
import { pickByUnitRequestKeys, readUnitRequestKeys } from './unitRequestKeys.js';
import { logWarn } from './logger.js';
import { resolveUnitRequestWorkStatus } from '../../src/lib/unitRequestWorkStatus.js';
import type { UnitRequestWorkStatus } from '../../src/lib/unitRequestWorkStatus.js';

export const isAutoMatchWorkStatus = (status: UnitRequestWorkStatus | string | null | undefined): boolean =>
  resolveUnitRequestWorkStatus(status as UnitRequestWorkStatus | null | undefined) === 'in_progress';

/** id ของใบที่ระบบจับคู่ให้เองได้ — ใบที่แนบ `work_status` มาแล้วใช้ค่านั้น · ไม่มี = อ่านจากตาราง */
export async function autoMatchJobIds(jobs: ReadonlyArray<Record<string, unknown>>): Promise<Set<string>> {
  const out = new Set<string>();
  const need: Array<Record<string, unknown>> = [];
  for (const j of jobs) {
    const id = String(j.id ?? '').trim();
    if (!id) continue;
    if ('work_status' in j && j.work_status != null) {
      if (isAutoMatchWorkStatus(String(j.work_status))) out.add(id);
    } else need.push(j);
  }
  if (need.length === 0) return out;
  try {
    const map = await getUnitWorkStatusMap(need.flatMap((j) => readUnitRequestKeys(j)));
    for (const j of need) {
      const row = pickByUnitRequestKeys(map, readUnitRequestKeys(j));
      if (isAutoMatchWorkStatus(row?.status)) out.add(String(j.id).trim());
    }
  } catch (e) {
    logWarn('auto-match.work-status.unread', { message: e instanceof Error ? e.message : String(e), jobs: need.length });
  }
  return out;
}
