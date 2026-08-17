/**
 * master "ตำแหน่งงาน" ของงานสรรหา (RM) — ชนิดข้อมูล + ตรรกะเลือกตำแหน่ง
 *
 * ยกมาจาก `recruit_master_job` ของ iRecruit (owner='RM' 479 แถว)
 * ดู `migrations/078_recruit_job_titles.sql` · แพตเทิร์นเดียวกับ `recruitReasons.ts`
 * (ชนิดข้อมูลอยู่ที่ `src/` แล้วให้ `api/` import ข้ามมา — ไม่มีนิยามสองชุด)
 *
 * ⚠️ **ต้นทางมีชื่อซ้ำกันจริง** (วัด 12 ส.ค. 2569: "เจ้าหน้าที่บัญชี" 4 แถว ·
 * "Engineer" 3 · "ธุรการจัดซื้อ" 3 · รวม 10 ชื่อที่ซ้ำ) เพราะซ้ำข้าม BU และมีของที่
 * ปิดใช้งานแล้วค้างอยู่ — ถ้าโยนเข้า dropdown ตรง ๆ ผู้ใช้จะเห็นชื่อเดียวกันหลายบรรทัด
 * แล้วไม่รู้จะเลือกอันไหน · `uniqueJobTitleNames()` จึงเป็นทางเดียวที่หน้าเว็บควรใช้
 *
 * ⚠️ ช่องตำแหน่งงาน **ยังต้องพิมพ์เองได้** — master ไม่ครบทุกตำแหน่งที่ลูกค้าขอมา
 * (ยกมา ณ วันหนึ่ง แล้วงานใหม่เกิดทุกสัปดาห์) จึงเป็น input + datalist ไม่ใช่ select
 * ปิดทางพิมพ์เมื่อไหร่ = เจ้าหน้าที่กรอกฟอร์มไม่จบเพราะไม่มีตำแหน่งของตัวเองในลิสต์
 *
 * ไฟล์นี้ pure ทั้งไฟล์ — เทสต์ที่ `tests/api/recruitJobTitles.test.ts`
 */

export type RecruitJobTitle = {
  id: string;
  name: string;
  /** ชื่ออังกฤษจากต้นทาง — ส่วนใหญ่ว่าง (ค้นเจอได้เมื่อมี) */
  nameEn: string | null;
  /** รหัส BU ที่ใช้ตำแหน่งนี้ ('LBD'/'LBA') · null = ต้นทางไม่ระบุ หรือรหัสที่เราไม่รู้จัก */
  departmentCode: string | null;
  sortOrder: number;
  isActive: boolean;
};

/** คีย์เทียบชื่อ — ตัดช่องว่างหัวท้าย ยุบช่องว่างซ้อน ไม่สนตัวพิมพ์ */
function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export type JobTitleFilter = {
  /** คำค้น — ตรงกับชื่อไทยหรือชื่ออังกฤษแบบ substring */
  keyword?: string;
  /**
   * รหัส BU ของงานที่กำลังกรอก — เก็บตำแหน่งของ BU นั้น **บวกตำแหน่งที่ไม่ระบุ BU**
   *
   * ⚠️ ตำแหน่งที่ `departmentCode` เป็น null ต้องไม่หายไปตอนกรอง — null แปลว่า
   * "ต้นทางไม่ได้บอก" ไม่ใช่ "ใช้กับ BU นี้ไม่ได้" · ตัดออกแล้วเจ้าหน้าที่จะหา
   * ตำแหน่งที่มีอยู่จริงไม่เจอ แล้วพิมพ์ชื่อใหม่ที่เพี้ยนจากของเดิมเข้าไปแทน
   */
  departmentCode?: string | null;
};

export function filterJobTitles(
  rows: RecruitJobTitle[],
  filter: JobTitleFilter = {},
): RecruitJobTitle[] {
  const kw = (filter.keyword ?? '').trim().toLowerCase();
  const dept = (filter.departmentCode ?? '').trim().toUpperCase();
  return rows.filter((r) => {
    if (dept && r.departmentCode && r.departmentCode.toUpperCase() !== dept) return false;
    if (kw) {
      const hay = `${r.name} ${r.nameEn ?? ''}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

/**
 * ชื่อตำแหน่งที่ไม่ซ้ำ สำหรับใส่ dropdown/datalist — **คงลำดับที่ API เรียงมาให้**
 * (`sort_order`, ชื่อ) ไม่เรียงใหม่เอง ไม่งั้นลำดับฝั่งเว็บกับฝั่ง API เพี้ยนกัน
 *
 * ชื่อว่าง/ช่องว่างล้วนถูกทิ้ง (ต้นทางวัดแล้วไม่มี แต่แถวที่คนคีย์เองในอนาคตมีได้)
 */
export function uniqueJobTitleNames(rows: RecruitJobTitle[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) continue;
    const key = nameKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** ชื่อตำแหน่งพร้อมใช้ในช่องกรอก — กรองตาม BU/คำค้นแล้วตัดชื่อซ้ำ */
export function jobTitleOptions(rows: RecruitJobTitle[], filter: JobTitleFilter = {}): string[] {
  return uniqueJobTitleNames(filterJobTitles(rows, filter));
}

/**
 * ค่าที่พิมพ์ตรงกับ master ไหม — ใช้บอกผู้ใช้ว่า "ตำแหน่งนี้ยังไม่มีใน master"
 * (เป็นข้อมูลให้อ่าน **ไม่ใช่การกัน** — พิมพ์ชื่อใหม่ต้องบันทึกได้เสมอ)
 */
export function isKnownJobTitle(rows: RecruitJobTitle[], value: string): boolean {
  const key = nameKey(value);
  if (!key) return false;
  return rows.some((r) => nameKey(r.name) === key);
}
