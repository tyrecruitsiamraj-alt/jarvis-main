# Jarvis / So Recruit — สเปกดึงข้อมูลสำหรับสคริปต์เสนองาน (Handoff)

เอกสารนี้สำหรับทีมภายนอกที่ต้องการสร้างข้อความเสนองานแบบ:

> ตอนนี้ทางสยามราชธานีมีงานขับรถให้นาย อยู่ที่ [สถานที่] วัน-เวลาทำงาน [รายละเอียด] เงินเดือนฐาน [12,000] บาท มีงานนอกเวลาเป็น OT รวมแล้วประมาณ [20,000] บาทขึ้นไปค่ะ คุณ [ชื่อ] สนใจไหมคะ

**แหล่งข้อมูลฝั่งเรา:** Jarvis API (อ่านจาก ERP Siamraj SQL Server + iRecruit SQL Server)  
**ไม่ใช้** ข้อมูล `position` / `skills` / `experience` จาก interview bot เป็นต้นทางงาน — ใช้เฉพาะชื่อผู้สมัคร

---

## 1. Authentication

ทุก endpoint ด้านล่างต้อง **login Jarvis ก่อน** แล้วส่ง session cookie

| ขั้นตอน | Method | Path |
|--------|--------|------|
| Login | `POST` | `/api/auth/login` |
| ตรวจ session | `GET` | `/api/auth/me` |

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@siamraj.com", "password": "..." }
```

Response สำเร็จ → Set-Cookie `session=...`  
Request ถัดไปต้องส่ง `credentials: include` (cookie)

---

## 2. API ที่ต้องเรียก

### 2.1 ดึงรายละเอียดใบงาน ERP (หลัก)

```http
GET /api/siamraj/unit-requests?id={jobId}
```

| Query | ตัวอย่าง | หมายเหตุ |
|-------|----------|----------|
| `id` | `siamraj-sql:OPL6907055` หรือ `OPL6907055` | เลขใบขอ ERP |

**Response (ฟิลด์ที่ใช้ในสคริปต์):**

```json
{
  "id": "siamraj-sql:OPL6907055",
  "request_no": "OPL6907055",
  "unit_name": "Ford Motor Company (Thailand) Limited",
  "site_code": "66LBDL0228",
  "staff_title_name": "พนักงานขับรถ",
  "job_description_code_1": "แรงงานสำรอง",
  "location_address": "บริษัท ฟอร์ด มอเตอร์ คัมปะนี ... จังหวัดระยอง 21140",
  "work_schedule": "วันจันทร์-ศุกร์ • 08.30-16.30 น",
  "total_income": 12000,
  "gender_requirement": "ชาย",
  "age_range_min": 25,
  "age_range_max": 50,
  "required_date": "2026-07-13",
  "contact_name": "K.Warren",
  "contact_phone": "038-954-111"
}
```

### 2.2 งานหลายสาขา — แยกสาขา + ผู้สมัครที่ match

```http
GET /api/matching/parse-branch-demand-job?jobId={jobId}&matches=1&poolSize=200
```

**Response (ส่วนสำคัญ):**

```json
{
  "jobId": "siamraj-sql:LBM6301012",
  "parser_input": "...",
  "parsed": {
    "items": [
      {
        "branch_name_clean": "ถ.สามเสน เขตดุสิต",
        "requested_qty": 2,
        "district_hint": "ดุสิต",
        "province_hint": "กรุงเทพมหานคร"
      },
      {
        "branch_name_clean": "สิงห์คอมเพล็กซ์ เขตห้วยขวาง",
        "requested_qty": 1,
        "district_hint": "ห้วยขวาง",
        "province_hint": "กรุงเทพมหานคร"
      }
    ]
  },
  "branch_matches": [
    {
      "branch_name_clean": "ถ.สามเสน เขตดุสิต",
      "requested_qty": 2,
      "matched_count": 1,
      "suggestions": [
        {
          "score": 85,
          "candidate": {
            "first_name": "สมชาย",
            "last_name": "ใจดี",
            "phone_number": "0812345678",
            "sex": "ชาย",
            "district_name": "ดุสิต",
            "province_name": "กรุงเทพมหานคร"
          }
        }
      ]
    }
  ]
}
```

### 2.3 รายชื่อผู้สมัคร iRecruit (ถ้าไม่ใช้ matching)

```http
GET /api/recruit-registrations?limit=200
```

```json
[
  {
    "first_name": "สมชาย",
    "last_name": "ใจดี",
    "phone_number": "0812345678",
    "sex": "ชาย",
    "age": 32,
    "district_name": "ดุสิต",
    "province_name": "กรุงเทพมหานคร",
    "job_name_th": "พนักงานขับรถ",
    "process_status_name": "รอดำเนินการ",
    "location_label": "ดุสิต, กรุงเทพมหานคร"
  }
]
```

### 2.4 จับคู่งานเดียว (ไม่แยกสาขา)

```http
GET /api/matching/suggestions?jobId={jobId}&limit=20
```

---

## 3. Map ช่องในสคริปต์ → ฟิลด์ Jarvis API

| ช่องในสคริปต์ | ฟิลด์ API (งาน) | ฟิลด์ API (ผู้สมัคร) | คอลัมน์ ERP ต้นทาง |
|---------------|-----------------|----------------------|-------------------|
| งานขับรถ / ประเภทงาน | `staff_title_name`, `job_description_code_1` | — | `hr_ms_staff_title`, `hr_ms_job_description_1` |
| นาย / คุณ | — | `sex` (ชาย/หญิง) | `recruit_register.sex` |
| สถานที่ | `location_address` หรือ `parsed.items[].branch_name_clean` | — | `st_request_p2.work_place1/2/3` |
| วัน-เวลาทำงาน | `work_schedule` | — | `st_request_p2.work_date` + `work_time` |
| เงินเดือนฐาน | `total_income` | — | `st_request_p3_rate.payment_rate` |
| OT รวมโดยประมาณ | *(ยังไม่ expose)* | — | `st_request_p3_rate.draw_rate` |
| ชื่อผู้สมัคร | — | `first_name` + `last_name` | `recruit_register.first_name/last_name` |
| เบอร์โทร (ไม่ใส่ในสคริปต์) | `contact_phone` = ผู้ติดต่อหน่วยงาน | `phone_number` | คนละ field |

**หมายเหตุ `work_schedule`:** ERP รวมเป็น string เดียว เช่น `วันจันทร์-ศุกร์ • 08.30-16.30 น` (คั่นด้วย ` • `)

---

## 4. Map จาก payload ภายนอก (interview bot)

ถ้าทีมภายนอกส่ง JSON แบบนี้:

```json
{
  "client_candidate_id": "cli-cand-8821",
  "candidate_name": "สมชาย ใจดี",
  "phone": "+66812345678",
  "position": "Senior Backend Engineer",
  "skills": ["Python"],
  "experience": [{ "salary": "60000" }]
}
```

| ใช้ได้ | ไม่ใช้เป็นต้นทางงาน |
|--------|---------------------|
| `candidate_name` → แยกชื่อ-นามสกุล | `position`, `skills`, `experience` |
| `phone` → โทรแยก (ไม่ใส่ในสคริปต์) | `questions`, `scheduled_at` |
| `client_candidate_id` → เก็บอ้างอิง | |

**ข้อมูลงานต้องดึงจาก Jarvis** ตามข้อ 2.1 เสมอ

---

## 5. Flow แนะนำ

```
1. GET /api/siamraj/unit-requests?id={jobId}     → งาน + เงิน + วันเวลา
2. GET /api/matching/parse-branch-demand-job?... → แยกสาขา (ถ้ามี) + รายชื่อ match
3. ต่อสคริปต์ต่อสาขา / ต่อคน
```

งานหลายสาขา: เรียกสคริปต์ **ทีละสาขา** ใช้ `branch_name_clean` เป็นสถานที่ ไม่ยัดทุกสาขาในประโยคเดียว

---

## 6. ตัวอย่าง Output สคริปต์

**Input**
- งาน: `LBM6301012`, ฐาน 18,000, วันจันทร์-ศุกร์ 08.30-16.30
- สาขา: `ถ.สามเสน เขตดุสิต`
- ผู้สมัคร: `สมชาย ใจดี`, เพศชาย
- OT ประมาณ: 20,000 (ใส่เอง หรือรอ `draw_rate` จาก ERP)

**Output**

```
ตอนนี้ทางสยามราชธานีมีงานขับรถให้นาย อยู่ที่ ถ.สามเสน เขตดุสิต วัน-เวลาทำงาน วันจันทร์-ศุกร์ 08.30-16.30 น เงินเดือนฐาน 18,000 บาท มีงานนอกเวลาเป็น OT รวมแล้วประมาณ 20,000 บาทขึ้นไปค่ะ คุณ สมชาย ใจดี สนใจไหมคะ
```

---

## 7. Logic สร้างสคริปต์ (ฝั่ง Jarvis)

มี helper ใน repo: `src/lib/recruitmentOutreachScript.ts`

```ts
import { buildRecruitmentOutreachScript, outreachInputFromExternalPayload } from '@/lib/recruitmentOutreachScript';

const { message } = buildRecruitmentOutreachScript(
  outreachInputFromExternalPayload(job, { candidate_name: 'สมชาย ใจดี' }, {
    branchName: 'ถ.สามเสน เขตดุสิต',
    otTotalEstimate: 20000,
  }),
);
```

ทีมภายนอกสามารถ implement logic เดียวกันตามตารางข้อ 3 ได้โดยไม่ต้อง import ไฟล์นี้

---

## 8. ข้อจำกัดปัจจุบัน

| หัวข้อ | สถานะ |
|--------|--------|
| `draw_rate` (OT จาก ERP) | ดึงใน SQL แล้ว แต่ **ยังไม่ส่งใน API response** — ต้องใส่ `otTotalEstimate` เอง |
| วัน/เวลาแยกต่อสาขา | ไม่มีใน ERP — ใช้ `work_schedule` ทั้งใบ |
| เงินแยกต่อสาขา | ไม่มี — ใช้ `total_income` ทั้งใบ |
| Auth | ต้องมีบัญชี Jarvis + role ที่เข้าถึง matching / siamraj feed |

---

## 9. Environment (ฝั่งเซิร์ฟเวอร์ Jarvis)

| ตัวแปร | ใช้สำหรับ |
|--------|-----------|
| `SIAMRAJ_DB_*` / SQL Server config | ใบงาน ERP |
| `IRECRUIT_DB_*` | ผู้สมัคร iRecruit |
| `SIAMRAJ_DB_SOURCE` | `sqlserver` (แนะนำ) หรือ `postgres` (ข้อมูลไม่ครบ) |

---

## 10. ติดต่อ / ตัวอย่าง jobId สำหรับทดสอบ

| เลขใบขอ | ลักษณะ |
|---------|--------|
| `OPL6907055` | สาขาเดียว, ขับรถ, ฐาน 12,000 |
| `LBM6301012` | หลายสาขา (ดุสิต 2 คน + ห้วยขวาง 1 คน), ฐาน 18,000 |

```http
GET /api/siamraj/unit-requests?id=siamraj-sql:OPL6907055
GET /api/matching/parse-branch-demand-job?jobId=siamraj-sql:LBM6301012&matches=1
```

---

*อัปเดต: 2026-07-09 — Jarvis main (So Recruit)*
