/**
 * ISO เวลาไทย `YYYY-MM-DDTHH:mm:ss+07:00` — instant เดียวกับ `toISOString()` แต่เขียน
 * ด้วย offset ไทยแทน `Z` (18 ส.ค. 2569: Lumos ดึงรายการไปแล้วแต่ไม่ขึ้นหน้าแจ้งเตือน
 * — หนึ่งในสามข้อสงสัยคือฝั่งเขาอ่านเวลารูป UTC แล้วปัดทิ้งเงียบ ๆ จึงส่งเป็นเวลาไทยให้ชัด)
 * ตั้งใจไม่ใช้ `Intl` — กติกาโปรเจกต์ห้าม `new Intl.*` นอกระดับโมดูล (เคยทำ API ช้า 4.7 วิ)
 *
 * แยกไฟล์ 28 ก.ย. 2569 ให้ตัวส่งซ้ำใบสมัครใช้ได้โดยไม่ต้อง import `lumosDispatch` ทั้งก้อน
 * (`lumosDispatch` ยังส่งออกชื่อเดิมต่อ — ที่เรียกอยู่ไม่ต้องแก้)
 */
export function bangkokIso(d: Date): string {
  const t = new Date(d.getTime() + 7 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` +
    `T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}+07:00`
  );
}
