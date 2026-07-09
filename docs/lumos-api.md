# Lumos AI Integration — API Reference

API เหล่านี้ใช้สำหรับ **Lumos** เรียกเข้ามาหา SO เท่านั้น  
Authentication ใช้ **API Key** (ไม่ใช่ JWT ของ user)

---

## Authentication

ทุก endpoint ต้องส่ง header:

```
Authorization: Bearer <LUMOS_API_KEY>
```

| Status | เงื่อนไข |
|--------|---------|
| `401 Unauthorized` | ไม่มี header หรือ key ผิด |
| `503 Service Unavailable` | ยังไม่ได้ตั้งค่า `LUMOS_API_KEY` ใน environment |

ตั้งค่า key ในไฟล์ `.env`:
```
LUMOS_API_KEY=your-secret-key-here
```

---

## Base URL

| Environment | URL |
|-------------|-----|
| Local dev   | `http://localhost:9000` |
| Production  | `https://your-domain.com` |

---

## AI Interview

### 1. GET /api/lumos/interview/candidates

Lumos เรียกเพื่อดึงรายชื่อ candidate ที่รอสัมภาษณ์

**Request**
```http
GET /api/lumos/interview/candidates
Authorization: Bearer <LUMOS_API_KEY>
```

**Response 200**
```json
{
  "ok": true,
  "data": [
    {
      "client_candidate_id": "cli-cand-8821",
      "client_interview_id": "cli-int-0042",
      "candidate_name": "สมชาย ใจดี",
      "phone": "+66812345678",
      "position": "Senior Backend Engineer",
      "scheduled_at": "2026-07-10T10:00:00+07:00",
      "questions": [
        "เล่าประสบการณ์การทำงานกับ Python ให้ฟังหน่อยครับ",
        "คาดหวังเงินเดือนเท่าไหร่ครับ"
      ],
      "type": "phone",
      "language": "th",
      "tone": "professional",
      "skills": ["Python", "FastAPI", "PostgreSQL"],
      "experience": [
        {
          "company": "Acme Corp",
          "position": "Backend Engineer",
          "period": "2022-2025",
          "responsibilities": "Built and maintained payment services",
          "salary": "60000",
          "level": "Senior",
          "business_type": "Fintech"
        }
      ],
      "education": [
        {
          "institution": "Chulalongkorn University",
          "degree": "Bachelor's",
          "faculty": "Engineering",
          "major": "Computer Engineering",
          "gpa": "3.5",
          "year_ce": 2020
        }
      ]
    }
  ],
  "total": 1
}
```

**Candidate Object Schema**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `client_candidate_id` | string | ✓ | SO candidate ID |
| `client_interview_id` | string | ✓ | SO interview ID |
| `candidate_name` | string | ✓ | |
| `phone` | string | ✓ | E.164 format เช่น `+66812345678` |
| `position` | string | ✓ | ชื่อตำแหน่งงาน |
| `scheduled_at` | string | ✓ | ISO 8601 |
| `questions` | string[] | ✓ | 1–15 ข้อ (แนะนำ 3–8) |
| `type` | string | | `"phone"` (default) หรือ `"online"` |
| `language` | string | | default `"th"` |
| `tone` | string | | default `"professional"` |
| `skills` | string[] | | ทักษะที่เกี่ยวข้อง |
| `experience` | object[] | | ประวัติการทำงาน |
| `education` | object[] | | ประวัติการศึกษา |

---

### 2. POST /api/lumos/interview/results

Lumos ส่งผลลัพธ์การสัมภาษณ์กลับมาให้ SO

**Request**
```http
POST /api/lumos/interview/results
Authorization: Bearer <LUMOS_API_KEY>
Content-Type: application/json

[
  {
    "interview_id": "8f3e2c1a-9b7d-4e5f-a123-1234567890ab",
    "client_candidate_id": "cli-cand-8821",
    "candidate_name": "สมชาย ใจดี",
    "position": "Senior Backend Engineer",
    "type": "phone",
    "status": "เสร็จสิ้น",
    "outcome": "completed",
    "scheduled_at": "2026-07-10T10:00:00+07:00",
    "phone": "+66812345678",
    "language": "th",
    "tone": "professional",
    "questions": ["เล่าประสบการณ์ Python"],
    "ai_score": 82,
    "summary": "ผู้สมัครมีประสบการณ์ตรงและตอบคำถามได้ชัดเจน",
    "strengths": ["Python เชี่ยวชาญ", "สื่อสารดี"],
    "concerns": ["คาดหวังเงินเดือนสูงกว่างบ"],
    "score_rationale": "ทักษะตรงกับตำแหน่ง 90% ประสบการณ์เพียงพอ",
    "confidence": "high",
    "failure_reason": null,
    "transcript": [
      { "role": "agent", "text": "สวัสดีครับ ขอสัมภาษณ์เบื้องต้นนะครับ" },
      { "role": "candidate", "text": "สวัสดีค่ะ ยินดีค่ะ" }
    ],
    "recording_url": "https://storage.lumos.ai/recordings/8f3e2c1a.mp3",
    "call_attempts": 1,
    "ended_reason": null,
    "duration_min": 7
  }
]
```

**Response 200**
```json
{
  "ok": true,
  "received": 1,
  "message": "Interview results accepted"
}
```

**Interview Result Object Schema**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `interview_id` | string | ✓ | UUID จาก Lumos |
| `client_candidate_id` | string | ✓ | ต้องตรงกับที่ GET ส่งให้ |
| `outcome` | string | ✓ | ดูค่าที่รองรับด้านล่าง |
| `candidate_name` | string | | |
| `position` | string | | |
| `type` | string | | `"phone"` \| `"online"` |
| `status` | string | | `"เสร็จสิ้น"` \| `"ยกเลิก"` |
| `ai_score` | integer\|null | | 0–100 |
| `summary` | string\|null | | สรุปการสัมภาษณ์ |
| `strengths` | string[]\|null | | จุดแข็ง |
| `concerns` | string[]\|null | | ข้อกังวล |
| `score_rationale` | string\|null | | เหตุผลคะแนน |
| `confidence` | string\|null | | `"high"` \| `"medium"` \| `"low"` |
| `failure_reason` | string\|null | | เหตุผลเมื่อ outcome ไม่สำเร็จ |
| `transcript` | object[] | | `{ role: "agent"\|"candidate", text: string }` |
| `recording_url` | string\|null | | URL เสียงบันทึก |
| `call_attempts` | integer | | จำนวนครั้งที่โทร |
| `ended_reason` | string\|null | | |
| `duration_min` | integer\|null | | ระยะเวลาสัมภาษณ์ (นาที) |

**ค่า `outcome` ที่รองรับ**

| ค่า | ความหมาย |
|-----|---------|
| `completed` | สัมภาษณ์สำเร็จ |
| `declined` | ผู้สมัครปฏิเสธ |
| `wrong_person` | โทรผิดคน |
| `unresponsive` | ไม่ตอบสนอง |
| `no_answer` | ไม่รับสาย |
| `busy` | สายไม่ว่าง |
| `failed` | เกิดข้อผิดพลาด |

---

## AI Reminder

### 3. GET /api/lumos/reminder/contacts

Lumos เรียกเพื่อดึงรายชื่อผู้ติดต่อที่ต้องแจ้งเตือน

**Request**
```http
GET /api/lumos/reminder/contacts
Authorization: Bearer <LUMOS_API_KEY>
```

**Response 200**
```json
{
  "ok": true,
  "data": [
    {
      "client_contact_id": "cli-emp-551",
      "recipient_name": "คุณสมหญิง",
      "recipient_phone": "+66898765432",
      "title": "นัดสัมภาษณ์พรุ่งนี้",
      "language": "th",
      "tone": "professional",
      "steps": [
        {
          "type": "remind",
          "message": "แจ้งเตือนนัดสัมภาษณ์พรุ่งนี้ 10:00 น.",
          "scheduled_at": "2026-07-10T14:00:00+07:00"
        },
        {
          "type": "follow_up",
          "message": "ติดตามยืนยันการเข้าสัมภาษณ์",
          "scheduled_at": "2026-07-10T18:00:00+07:00"
        }
      ]
    }
  ],
  "total": 1
}
```

**Contact Object Schema**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `client_contact_id` | string | ✓ | SO contact/employee ID |
| `recipient_name` | string | ✓ | |
| `recipient_phone` | string | ✓ | E.164 format |
| `steps` | object[] | ✓ | ดู Step schema ด้านล่าง |
| `title` | string | | หัวข้อการแจ้งเตือน |
| `language` | string | | default `"th"` |
| `tone` | string | | default `"professional"` |

**Step Object Schema**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | string | ✓ | `"remind"` \| `"follow_up"` \| `"confirmation"` |
| `message` | string | ✓ | ข้อความที่ AI จะพูด |
| `scheduled_at` | string | ✓ | ISO 8601 |

---

### 4. POST /api/lumos/reminder/results

Lumos ส่งผลลัพธ์การแจ้งเตือนกลับมาให้ SO

**Request**
```http
POST /api/lumos/reminder/results
Authorization: Bearer <LUMOS_API_KEY>
Content-Type: application/json

[
  {
    "plan_id": "5c2a9e10-3f4b-4a2c-9d1e-abcdef012345",
    "step_id": "d1e2f3a4-5b6c-7d8e-9f01-234567890abc",
    "client_contact_id": "cli-emp-551",
    "title": "นัดสัมภาษณ์พรุ่งนี้",
    "recipient_name": "คุณสมหญิง",
    "recipient_phone": "+66898765432",
    "step_position": 0,
    "step_type": "remind",
    "message": "แจ้งเตือนนัดสัมภาษณ์พรุ่งนี้ 10:00 น.",
    "scheduled_at": "2026-07-10T14:00:00+07:00",
    "language": "th",
    "tone": "professional",
    "status": "completed",
    "outcome": "confirmed",
    "summary": "ผู้รับสายยืนยันว่าจะเข้าร่วมสัมภาษณ์ตามเวลานัด",
    "transcript": [
      { "role": "agent", "text": "สวัสดีค่ะ ขอแจ้งเตือนนัดสัมภาษณ์พรุ่งนี้ 10:00 น." },
      { "role": "candidate", "text": "รับทราบค่ะ" }
    ],
    "recording_url": "https://storage.lumos.ai/recordings/d1e2f3a4.mp3",
    "call_attempts": 1,
    "ended_reason": null,
    "plan_status": "completed",
    "stop_early": true
  }
]
```

**Response 200**
```json
{
  "ok": true,
  "received": 1,
  "message": "Reminder results accepted"
}
```

**Reminder Result Object Schema**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `plan_id` | string | ✓ | UUID ของแผนการแจ้งเตือน (จาก Lumos) |
| `step_id` | string | ✓ | UUID ของ step นี้ |
| `client_contact_id` | string | ✓ | ต้องตรงกับที่ GET ส่งให้ |
| `status` | string | ✓ | `"completed"` \| `"failed"` \| `"cancelled"` |
| `outcome` | string | ✓ | ดูค่าที่รองรับด้านล่าง |
| `title` | string | | |
| `recipient_name` | string | | |
| `recipient_phone` | string | | |
| `step_position` | integer | | 0-based index ของ step |
| `step_type` | string | | `"remind"` \| `"follow_up"` \| `"confirmation"` |
| `message` | string | | |
| `scheduled_at` | string | | ISO 8601 |
| `language` | string | | |
| `tone` | string | | |
| `summary` | string\|null | | สรุปการสนทนา |
| `transcript` | object[] | | `{ role: "agent"\|"candidate", text: string }` |
| `recording_url` | string\|null | | |
| `call_attempts` | integer | | |
| `ended_reason` | string\|null | | |
| `plan_status` | string | | `"active"` \| `"completed"` \| `"cancelled"` |
| `stop_early` | boolean | | `true` = ยืนยันแล้ว ยกเลิก step ที่เหลือ |

**ค่า `outcome` ที่รองรับ**

| ค่า | ความหมาย |
|-----|---------|
| `confirmed` | ยืนยันแล้ว |
| `acknowledged` | รับทราบแล้ว |
| `declined` | ปฏิเสธ |
| `reschedule_requested` | ขอเลื่อนนัด |
| `wrong_person` | โทรผิดคน |
| `no_answer` | ไม่รับสาย |
| `busy` | สายไม่ว่าง |
| `unresponsive` | ไม่ตอบสนอง |
| `failed` | เกิดข้อผิดพลาด |
| `cancelled` | ยกเลิก |

---

## Error Responses

| HTTP Status | `error` | สาเหตุ |
|-------------|---------|--------|
| `400 Bad Request` | `Bad Request` | Body ไม่ถูกต้อง หรือขาด required fields |
| `401 Unauthorized` | `Unauthorized` | API key ผิด หรือไม่มี Authorization header |
| `405 Method Not Allowed` | `Method Not Allowed` | HTTP method ไม่ถูกต้อง |
| `500 Internal Server Error` | `Internal server error` | เกิดข้อผิดพลาดภายใน server |
| `503 Service Unavailable` | `Service Unavailable` | `LUMOS_API_KEY` ยังไม่ได้ตั้งค่าใน server |

**Error Response Format**
```json
{
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

---

## Quick Test (cURL)

```bash
# ตั้งค่า key
LUMOS_KEY="replace-with-your-lumos-api-key"
BASE="http://localhost:9000"

# GET candidates
curl -s -H "Authorization: Bearer $LUMOS_KEY" "$BASE/api/lumos/interview/candidates" | jq .

# POST interview result
curl -s -X POST "$BASE/api/lumos/interview/results" \
  -H "Authorization: Bearer $LUMOS_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"interview_id":"test-001","client_candidate_id":"cli-cand-8821","outcome":"completed"}]' | jq .

# GET reminder contacts
curl -s -H "Authorization: Bearer $LUMOS_KEY" "$BASE/api/lumos/reminder/contacts" | jq .

# POST reminder result
curl -s -X POST "$BASE/api/lumos/reminder/results" \
  -H "Authorization: Bearer $LUMOS_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"plan_id":"plan-001","step_id":"step-001","client_contact_id":"cli-emp-551","status":"completed","outcome":"confirmed"}]' | jq .
```

---

## Flow Diagram

```
Lumos                           SO API
  │                               │
  │── GET /lumos/interview/candidates ──▶│
  │◀── [ candidate list ] ──────────────│
  │                               │
  │  (Lumos calls candidates...)  │
  │                               │
  │── POST /lumos/interview/results ───▶│
  │◀── { ok: true, received: N } ───────│
  │                               │
  │── GET /lumos/reminder/contacts ────▶│
  │◀── [ contact list ] ────────────────│
  │                               │
  │  (Lumos sends reminders...)   │
  │                               │
  │── POST /lumos/reminder/results ────▶│
  │◀── { ok: true, received: N } ───────│
```
