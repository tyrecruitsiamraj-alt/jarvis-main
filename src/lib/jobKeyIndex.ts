/**
 * จับคู่ของฝั่งเรา (ประกาศ · ยอดผู้สมัคร · ช่องทาง) กับ **ใบขอจาก ERP** ที่ id ไม่ตรงกัน
 *
 * 🔴 กับดักเดิมของโปรเจกต์: feed ของ ERP ให้ใบ**ล่วงหน้า**เป็น `siamraj-pre:LBM6908001`
 * แต่ประกาศที่ผูกกับใบเดียวกันเก็บ `jobId = siamraj-sql:LBM6908001` → เทียบ id เต็ม
 * ตรง ๆ **จับคู่ไม่ติดทั้งกอง** (31 ใบล่วงหน้าในฐาน) อาการที่เห็น: ชิปเขียว
 * "ปล่อยลิงก์แล้ว" ไม่ขึ้น · แท็บ "แก้ไข" ในป๊อปหาย · แถบลิงก์เงียบไม่นับใบพวกนี้ ·
 * ยอดผู้สมัคร/ช่องทางบนการ์ดเป็น 0 ทั้งที่มีคนสมัครจริง
 *
 * วิธีแก้ = แพตเทิร์นเดียวกับทะเบียนปล่อยใบ (`jobPublicReleaseApi.buildReleaseIndex`):
 * **เก็บสองคีย์ เทียบสองคีย์ — id เต็มก่อน แล้วถอยไปเลขที่ใบขอ**
 *
 * 🔴 **เลขที่ใบขอเป็นทางถอย ห้ามเป็นคีย์หลัก** — ในฐานจริงมีเลขที่ซ้ำกัน **23 ใบ
 * ข้ามบริษัท** (เช่น `LBM6908001` ล่วงหน้า = อีซูซุมอเตอร์ · ปกติ = ชับบ์ ไลฟ์)
 * ดังนั้นเลขที่ที่ชนกันเอง **ถูกตัดออกจาก index** (ambiguous = ไม่จับคู่)
 * ยอมพลาดดีกว่าเอาข้อมูลของอีกบริษัทมาแปะ
 */

/** `siamraj-sql:OPL6908001` → `OPL6908001` (ไม่มี prefix ก็คืนค่าเดิม) */
export function requestNoOf(jobId: string): string {
  const i = jobId.lastIndexOf(':');
  return i >= 0 ? jobId.slice(i + 1) : jobId;
}

/**
 * อ่านค่าตาม job id — สัญญาเดียวกับ `Map.get` โดยเจตนา
 * (ผู้เรียกที่ยังส่ง `Map` ธรรมดามาก็ใช้ได้ ไม่ต้องแก้ทั้งระบบพร้อมกัน)
 */
export type JobKeyReader<T> = {
  get(jobId: string): T | undefined;
};

export type JobKeyIndex<T> = JobKeyReader<T> & {
  has(jobId: string): boolean;
  /** จำนวน entry ที่คีย์ด้วย id เต็ม (ไม่นับคีย์สำรอง) */
  size: number;
};

/**
 * สร้าง index จากคู่ `[jobId, value]`
 *
 * @param merge รวมค่าเมื่อ id เต็มซ้ำกัน (ไม่ส่ง = ตัวแรกชนะ) — ใช้กับยอดคลิกที่ต้องบวกกัน
 *
 * ⚠️ ห้ามใช้ `includes`/`endsWith` เทียบเลขที่ใบ — `LBM690800` ต้องไม่แมตช์ `LBM6908001`
 * (เทสต์ล็อกไว้ทั้งที่นี่และที่ `jobPublicRelease.test.ts`)
 */
export function buildJobKeyIndex<T>(
  entries: Iterable<readonly [string | null | undefined, T]>,
  merge?: (existing: T, incoming: T) => T,
): JobKeyIndex<T> {
  const byId = new Map<string, T>();
  /** เลขที่ใบ → id เต็มที่ให้เลขนั้น · มากกว่า 1 = คนละใบ (อาจคนละบริษัท) */
  const idsPerNo = new Map<string, Set<string>>();

  for (const [rawId, value] of entries) {
    const id = (rawId || '').trim();
    if (!id) continue;

    const prev = byId.get(id);
    byId.set(id, prev === undefined ? value : merge ? merge(prev, value) : prev);

    const no = requestNoOf(id).trim();
    if (!no) continue;
    const seen = idsPerNo.get(no);
    if (seen) seen.add(id);
    else idsPerNo.set(no, new Set([id]));
  }

  // คีย์สำรอง: ใส่เฉพาะเลขที่ที่ชี้ไปใบเดียวจริง ๆ — ชนกัน = ไม่จับคู่ (ห้ามเดา)
  const byNo = new Map<string, T>();
  for (const [no, ids] of idsPerNo) {
    if (ids.size !== 1) continue;
    const value = byId.get([...ids][0]);
    if (value !== undefined) byNo.set(no, value);
  }

  const get = (jobId: string): T | undefined => {
    const direct = byId.get(jobId);
    if (direct !== undefined) return direct;
    return byNo.get(requestNoOf(jobId));
  };

  return { get, has: (jobId) => get(jobId) !== undefined, size: byId.size };
}

/**
 * index จาก `Record<jobId, number>` (ยอดนับจาก API ที่คีย์ด้วย job_id ของฝั่งเรา)
 * — ยอดผู้สมัคร/Lead มาแบบนี้ และคีย์ของมันสืบทอด `posting.jobId` จึงเป็น `sql:` เสมอ
 */
export function buildCountIndex(counts: Readonly<Record<string, number>>): JobKeyIndex<number> {
  return buildJobKeyIndex(Object.entries(counts));
}

/** อ่านยอดนับแบบเทียบสองคีย์ — ไม่มีค่า = 0 */
export function countFor(index: JobKeyReader<number>, jobId: string): number {
  return index.get(jobId) ?? 0;
}
