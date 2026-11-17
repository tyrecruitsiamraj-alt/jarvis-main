# ภาพรวมงานสรรหา v2 — แผนงานและสถานะ (เริ่ม 17 พ.ย. 2569)

เจ้าของสั่ง 17 พ.ย. 2569: ทำ `/jobs/board?view=dashboard` ตามแบบ ZIP `Jarvis-Recruit-Overview-Claude-Final-Checked.zip` (v2)
ให้ผ่าน ACCEPTANCE.txt ทุกหมวด · ห้ามข้อมูล/ฟังก์ชันเดิมหาย · ใช้ข้อมูลจริง ห้ามฝังตัวเลข · ผลย้อนหลัง = ผล ณ วันสิ้นสุด
เจ้าของรับว่าใช้เวลานาน ("เอาตามนั้นจะใช้เวลานานก็จะทำทำเลย")

- worktree: `~/Desktop/jarvis-wt-ov2` branch `recruit-overview-v2` (จาก origin/main)
- ZIP แตกไว้ที่ scratchpad ของ session (`overview-zip/claude-recruit-overview-2026-11-17-v2/`) — ห้าม commit `design/` (มีข้อมูลจริงในตัว)
- เปิดดูแบบ: ตั้ง static server ที่โฟลเดอร์ `design/` แล้วเปิด `recruit-one-page.html` (ต้อง decode UTF-8 เอง — ไฟล์ไม่มี charset)

## รอบงาน
1. **ข้อมูล + mapping** — ตาราง no-loss (ของเดิม → ที่อยู่ในหน้าใหม่) · เติม field ที่ขาด (อายุ · จังหวัดที่อยู่ · ผล ณ วันสิ้นสุด)
2. **ตาราง อายุ/จังหวัด/ช่องทาง × 5 ยอด + กราฟเทียบ BU จำนวน/%** (measure/display ไม่กรองประชากร)
3. **drawer ด้านข้าง** เจาะถึงรายชื่อ/ใบขอ · Back คืนหน้า · pagination 10 แถวทั้ง main และ drawer
4. **ตรวจตาม ACCEPTANCE A–G** → เปิดเป็นค่าเริ่ม (หน้าเดิมเป็นทางถอย)

## สถาปัตยกรรม
- ข้อมูลหลัก = `/api/recruit-overview` (`RecruitOverviewResponse.apps: RecruitAppFact[]`) — นิยามเดิมทั้งหมดใช้ต่อ
  (`peopleSteps` · `buildPersonJourney` · `buildFollowCallers` · `funnelPlaceOf/funnelSubOf` · `reasonGroups`)
- ใบขอ/การประกาศ = `/api/recruit-stuck` (ของเดิม) — 9 สถานะรายใบตามแบบ map จาก phase เดิม
- ผล ณ วันสิ้นสุด: ฝั่ง server ใส่ cutoff ใน lateral ของ facts (เวลา < สิ้นวัน `to` ไทย) เฉพาะช่วงที่ `to` < วันนี้
  ขาดประวัติ (สถานะคิว AI ย้อนหลัง · ERP ก่อนมีประวัติ) → "—" + coverage ห้าม 0
- อายุ = `public_job_applications.age` (ค่าปัจจุบัน — บอกข้อจำกัด) · จังหวัดที่อยู่ = `public_job_applications.province` (ไม่ใช่จังหวัดงาน)
- หน้าใหม่อยู่หลัง `&dash=v2` จนผ่านด่าน แล้วค่อยสลับเป็นค่าเริ่ม (หน้าเดิมเข้าได้ผ่าน `&dash=topics`)

## สถานะ (อัปเดต 17 พ.ย. 2569 ค่ำ)
- ✅ ข้อมูล: `api/_lib/overviewAsOf.ts` (ผล ณ วันสิ้นสุด · ?asof=1) · age/homeProvince ต่อใบ — commit 9dc843e2
- ✅ ตัวคำนวณ: `src/lib/recruitAudience.ts` (+เทสต์ 8) · `v2/v2Model.ts`
- ✅ จอแรก: `src/components/dashboard-trends/v2/` RecruitOverviewV2 · V2Drawer · V2Parts — เปิด `&dash=v2`
  ทดสอบจริง: Facebook 1,027 → 36–45 ปี 404 → กรุงเทพ 216 · % รวม 44/1,027 = 4.3% · Back คืนชั้นเดิม
- ⏳ ต่อไป: ผู้นัด (ต้องเติม field ผู้บันทึกนัด) · 9 สถานะการประกาศรายใบ · ใบขอใหม่ตามวันคีย์ ERP (record_date — adapter แยก)
  · กดแท่งกราฟเวลาในแผง · เทียบ BU ในแผง metric แบบ % · เบอร์ไม่ซ้ำ · ประวัติผลตามวัน · คลิกฟอร์ม · จอแคบ · ด่าน ACCEPTANCE A–G
- ยังไม่ push (ทำบน branch `recruit-overview-v2`)

## ตาราง no-loss (เติมระหว่างทำ)
| ของเดิม (โฉม topics/scale/list) | อยู่ที่ไหนใน v2 | สถานะ |
|---|---|---|
| (กำลังไล่) | | |

## ช่องว่างข้อมูลที่ต้องบอกบนจอ (ไม่แก้ด้วยการเติมเลข)
- ประวัติสถานะใบขอรายใบย้อนหลังไม่มี (`recruit_request_daily` เริ่ม 16 พ.ย. เป็นยอดรวม)
- คนเปิดฟอร์มไม่กรอก นับไม่ได้ · เบอร์ไม่ซ้ำ ≠ คนไม่ซ้ำ · ERP = จับคู่เบอร์+ใบขอ
- สนใจหลังคนโทร ยังไม่มีผลชัด → คอลัมน์ "สนใจหลัง AI โทร" เท่านั้น
- อายุ/จังหวัดเป็นค่าปัจจุบัน ไม่ใช่ ณ วันในอดีต
