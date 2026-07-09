# Driver Care — เอกสารอ้างอิง

## การทำงาน (Read vs Recalculate)

- **GET** `/api/driver-care?view=overview|risk-list|actions` — อ่านข้อมูลเท่านั้น **ไม่คำนวณคะแนน**
- วันที่ธุรกิจใช้ **Asia/Bangkok** (`businessDate`)
- ถ้ายังไม่มีคะแนนวันนี้ จะแสดงคะแนนล่าสุดที่มี หรือ empty state พร้อม `needsRecalculation: true`
- **POST** `/api/driver-care/recalculate` — คำนวณคะแนนใหม่ (supervisor/admin เท่านั้น) + audit log
- ไม่ fallback ไปพนักงานทั้งหมดถ้า filter คนขับไม่เจอ

### Scheduled calculation (เตรียมไว้)

ใช้ `runScheduledDriverCareRecalculation()` จาก `api/_lib/driverCareSchedule.ts`  
สามารถผูกกับ Vercel Cron ในอนาคต (ตั้ง `DRIVER_CARE_CRON_SECRET` ใน `.env`)

---

วางไฟล์ความรู้ที่นี่ เช่น PDF, รูปภาพ หรือ markdown เกี่ยวกับพฤติกรรมก่อนลาออก

จากนั้นเพิ่มรายการใน **Driver Care → Skills & Knowledge** แล้วใส่ลิงก์ไฟล์ในช่อง `file_url`  
(เช่น `/docs/driver-care/pre-resign-behavior.pdf` หรือ URL ภายนอก)

## ตัวอย่างหัวข้อ Knowledge

- พฤติกรรมลด OT ก่อนลาออก
- ขาดงาน / มาสายบ่อยขึ้น
- ลดการตอบแชทหรือหลีกเลี่ยงการประชุม
- เปลี่ยนแปลงทัศนคติต่อลูกค้าหรือหัวหน้างาน
