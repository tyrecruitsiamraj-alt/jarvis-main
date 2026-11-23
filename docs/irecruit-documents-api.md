# API ดึงเอกสารผู้สมัครจาก So Recruit (สำหรับทีม iRecruit)

ผู้สมัครส่งเอกสารผ่าน LINE ใน So Recruit (บัตรประชาชน · ใบขับขี่ · ทะเบียนบ้าน · คำตอบเอกสาร 5 ฉบับ · ลายเซ็น)
iRecruit ดึงข้อมูลและไฟล์ของผู้สมัครที่มีในระบบ iRecruit ได้ด้วย **เลขบัตรประชาชน**

## ยืนยันตัว

ทุกคำขอต้องมี header `x-api-key: <กุญแจ>`
ใช้กุญแจชื่อ `irecruit` ตัวเดียวกับ API ผลแบบทดสอบ (ผู้ดูแลระบบ So Recruit ออก/ยกเลิกได้ที่ ตั้งค่า › เชื่อมระบบภายนอก)

ฐาน URL: `https://jarvis.siamrajathanee.dev/api/integrations/irecruit/applicant-documents`

## 1. ดึงชุดเอกสารของผู้สมัคร

```
GET {ฐาน URL}?national_id=1103700456783
```

- พบ: `200` ข้อมูลชุดล่าสุดที่ผู้สมัครส่ง
- ไม่พบ: `404` `{ "found": false, "message": "ไม่พบเอกสารของเลขบัตรนี้" }`
- เลขบัตรผิดรูป: `400`

ตัวอย่างคำตอบ (ข้อมูลสมมติ)

```json
{
  "found": true,
  "packet_id": "9e045f59-789c-4772-8da5-14d581485d0c",
  "submitted_at": "2026-11-23T04:22:10.000Z",
  "job": "หน่วยงานตัวอย่าง · พนักงานขับรถ",
  "person": {
    "prefix": "นาย", "firstName": "สมชาย", "lastName": "ทดสอบดี",
    "dob": "1990-01-15", "nationalId": "1103700456783", "phone": "0800000000",
    "firstNameEn": "Somchai", "lastNameEn": "Thodsobdee",
    "idIssued": "2022-02-10", "idExpiry": "2031-01-14",
    "licenseNumber": "65001234", "licenseNationalId": "1103700456783",
    "licenseType": "รถยนต์ส่วนบุคคล", "licenseIssued": "2022-03-01", "licenseExpiry": "2029-03-01"
  },
  "person_labels": { "firstName": "ชื่อ", "...": "..." },
  "id_lifetime": false,
  "license_lifetime": false,
  "address": {
    "registered": "99/1 หมู่ 4 ตำบลบางพลีใหญ่ อำเภอบางพลี สมุทรปราการ 10540",
    "current": "99/1 หมู่ 4 ตำบลบางพลีใหญ่ อำเภอบางพลี สมุทรปราการ 10540",
    "same_as_registered": true
  },
  "consents": [
    { "doc": "background", "title": "หนังสือยินยอมให้ตรวจประวัติ", "answer": "yes", "answer_label": "ยินยอมให้ตรวจประวัติ" }
  ],
  "sender": { "line_display_name": "ชื่อบัญชี LINE", "relation": "self" },
  "files": [
    { "file_id": "…", "kind": "id", "label": "บัตรประชาชน ด้านหน้า", "mime": "image/jpeg", "url": "{ฐาน URL}?national_id=…&file=…" },
    { "file_id": "…", "kind": "license", "label": "ใบขับขี่ ด้านหน้า", "mime": "image/jpeg", "url": "…" },
    { "file_id": "…", "kind": "house", "label": "ทะเบียนบ้าน หน้าที่มีชื่อ", "mime": "image/jpeg", "url": "…" }
  ],
  "pdfs": [
    { "doc": "background", "title": "หนังสือยินยอมให้ตรวจประวัติ", "url": "{ฐาน URL}?national_id=…&pdf=background&packet_id=…" }
  ],
  "imported": null
}
```

วันที่ทุกช่องเป็น ค.ศ. รูปแบบ `YYYY-MM-DD` · ช่องที่ผู้สมัครไม่ได้กรอก = `null`
`relation` = `self` (ผู้สมัครเอง) หรือ `representative` (ส่งแทนผู้สมัคร)
`imported` = ข้อมูลการนำเข้าครั้งก่อน (ถ้าเคยแจ้งไว้ตามข้อ 3)

## 2. โหลดรูปและ PDF

ใช้ `url` ที่ได้จากข้อ 1 ได้เลย (ต้องส่ง header `x-api-key` ทุกครั้ง)

- รูป: `GET {ฐาน URL}?national_id=…&file=<file_id>` → `image/jpeg` หรือ `image/png`
- PDF: `GET {ฐาน URL}?national_id=…&pdf=<doc>&packet_id=<packet_id>` → `application/pdf`
  (PDF = ต้นฉบับเอกสารบริษัทที่ผู้สมัครอ่าน + หน้าแนบท้ายข้อมูล คำตอบ และลายเซ็น)

เลขบัตรต้องตรงกับเจ้าของไฟล์ · รู้รหัสไฟล์อย่างเดียวเปิดไม่ได้

## 3. แจ้งกลับว่าบันทึกเข้า iRecruit แล้ว

```
POST {ฐาน URL}
Content-Type: application/json

{ "national_id": "1103700456783", "packet_id": "9e045f59-…", "irecruit_applicant_no": "A123456", "department": "SN" }
```

- สำเร็จ: `200` `{ "packet_id": "…", "irecruit_applicant_no": "A123456", "already": false }`
- ส่งซ้ำเลขเดิม: `200` `already: true`
- ชุดนี้เคยแจ้งไว้ด้วยเลขอื่น: `409`

แจ้งแล้ว HR จะเห็นชุดนี้เป็น "นำเข้าแล้ว" พร้อมเลขที่ผู้สมัครใน So Recruit (`department` ไม่บังคับ)

## ข้อควรระวัง

- ข้อมูลเป็นข้อมูลส่วนบุคคล (เลขบัตร รูปบัตร) — เก็บกุญแจไว้ฝั่งเซิร์ฟเวอร์เท่านั้น ห้ามใส่ในหน้าเว็บหรือแอป
- ห้าม cache คำตอบไว้ในที่ที่คนอื่นเข้าถึงได้ · ผู้สมัครที่ขอลบข้อมูล (PDPA) จะได้ `404`
- รหัสสถานะ: `401` ไม่มี/ผิดกุญแจ · `503` ยังไม่ได้ออกกุญแจ · `400` ข้อมูลผิดรูป · `404` ไม่พบ · `409` ชน
