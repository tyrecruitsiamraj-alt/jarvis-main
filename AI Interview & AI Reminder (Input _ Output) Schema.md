# **AI Interview & AI Reminder (Input / Output) Schema**

## **AI Interview**

### 

1. ### **Lumos ยิง API ไป Get ข้อมูล Candidate จาก SO**     Schema ของข้อมูล Candidate ที่ต้องการได้รับ

| Field | Type | Required | Notes |
| :---- | :---- | :---- | :---- |
| client\_candidate\_id | string | ✓ | SO candidate id |
| client\_interview\_id | string | ✓ | SO interview id |
| candidate\_name | string | ✓ |  |
| phone | string | ✓ | E.164, e.g. \+66812345678 |
| position | string | ✓ | Job title |
| scheduled\_at | string | ✓ | now or future |
| questions | string\[\] | ✓ | 1–15 items (recommend 3–8) |
| type | string |  | "phone" (default) or "online" |
| language | string |  | default "th" |
| tone | string |  | Default "professional" |
| skills | string\[\] |  |  |
| experience | object\[\] |  |  |
| education | object\[\] |  |  |

**experience\[\] item:** 

{ 

"company": string, 

"position": string, 

"period": string, 

"responsibilities": string, 

"salary": string, 

"level": string, 

"business\_type": string 

} 

— all fields optional, present when known

**education\[\] item:** 

{ 

"institution": string, 

"degree": string, 

"faculty": string, 

"major": string, 

"details": string, 

"gpa": string, 

"year\_ce": integer 

} 

— all fields optional, present when known

**ตัวย่างข้อมูล**

\[{  
  "client\_candidate\_id": "cli-cand-8821",  
  "client\_interview\_id": "cli-int-0042",  
  "candidate\_name": "สมชาย ใจดี",  
  "phone": "+66812345678",  
  "position": "Senior Backend Engineer",  
  "scheduled\_at": "2026-07-02T10:00:00+07:00",  
  "questions": \["เล่าประสบการณ์ Python", "เงินเดือนที่คาดหวัง"\],  
  "skills": \["Python", "FastAPI", "PostgreSQL"\],  
  "experience": \[  
    {  
      "company": "Acme Corp",  
      "position": "Backend Engineer",  
      "period": "2022-2025",  
      "responsibilities": "Built and maintained payment services",  
      "salary": "60000",  
      "level": "Senior",  
      "business\_type": "Fintech"  
    }  
  \],  
  "education": \[  
    {  
      "institution": "Chulalongkorn University",  
      "degree": "Bachelor's",  
      "faculty": "Engineering",  
      "major": "Computer Engineering",  
      "gpa": "3.5",  
      "year\_ce": 2020  
    }  
  \]  
}\]

### ---

2. ### **Lumos ยิง API ไป Update ข้อมูลการ Interview ให้ SO**    Schema ของข้อมูลผลลัพธ์การสัมภาษณ์ที่ส่งไปให้

| Field | Type | Notes |
| :---- | :---- | :---- |
| interview\_id | string |  |
| client\_candidate\_id | string |  |
| candidate\_name | string |  |
| position | string |  |
| type | string | "phone" | "online" |
| status | string | "เสร็จสิ้น" | "ยกเลิก" |
| outcome | string |  |
| scheduled\_at | string |  |
| phone | string | null |  |
| language | string |  |
| tone | string |  |
| questions | string\[\] |  |
| ai\_score | integer | null | 0–100 |
| summary | string | null |  |
| strengths | string\[\] | null |  |
| concerns | string\[\] | null |  |
| score\_rationale | string | null |  |
| confidence | string | null | "high" | "medium" | "low" |
| failure\_reason | string | null |  |
| transcript | object\[\] |  |
| recording\_url | string | null |  |
| call\_attempts | integer |  |
| ended\_reason | string | null |  |
| duration\_min | integer | null |  |

**outcome:** completed, declined, wrong\_person, unresponsive, no\_answer, busy, failed

**transcript\[\] item:** { "role": "agent" | "candidate", "text": string }

**ตัวย่างข้อมูล**

\[{  
  "interview\_id": "8f3e2c1a-9b7d-4e5f-a123-1234567890ab",  
  "client\_candidate\_id": "cli-cand-8821",  
  "candidate\_name": "สมชาย ใจดี",  
  "position": "Senior Backend Engineer",  
  "type": "phone",  
  "status": "เสร็จสิ้น",  
  "outcome": "completed",  
  "scheduled\_at": "2026-07-02T10:00:00+07:00",  
  "phone": "+66812345678",  
  "language": "th",  
  "tone": "professional",  
  "questions": \["เล่าประสบการณ์ Python", "เงินเดือนที่คาดหวัง"\],  
  "ai\_score": 82,  
  "summary": "ผู้สมัครมีประสบการณ์ตรงและตอบคำถามได้ชัดเจน",  
  "strengths": \["Python เชี่ยวชาญ", "สื่อสารดี"\],  
  "concerns": \["คาดหวังเงินเดือนสูงกว่างบ"\],  
  "score\_rationale": "ทักษะตรงกับตำแหน่ง 90% ประสบการณ์เพียงพอ",  
  "confidence": "high",  
  "failure\_reason": null,  
  "transcript": \[  
    { "role": "agent", "text": "สวัสดีครับ ขอสัมภาษณ์เบื้องต้นนะครับ" },  
    { "role": "candidate", "text": "สวัสดีค่ะ ยินดีค่ะ" }  
  \],  
  "recording\_url": "https://storage.lumos.ai/recordings/8f3e2c1a.mp3?sig=...",  
  "call\_attempts": 1,  
  "ended\_reason": null,  
  "duration\_min": 7  
}\]

## **AI Reminder**

### 

1. ### **Lumos ยิง API ไป Get ข้อมูลติดต่อพนักงานจาก SO**     Schema ของข้อมูลติดต่อพนักงานที่ต้องการได้รับ

| Field | Type | Required | Notes |
| :---- | :---- | :---- | :---- |
| client\_contact\_id | string | ✓ |  |
| recipient\_name | string | ✓ |  |
| recipient\_phone | string | ✓ |  |
| steps | object\[\] | ✓ |  |
| title | string |  |  |
| language | string |  | Default "th" |
| tone | string |  | Default "professional" |

**Per step (steps\[\] item)**

| Field | Type | Required | Notes |
| :---- | :---- | :---- | :---- |
| type | string | ✓ | "remind" | "follow\_up" | "confirmation" |
| message | string | ✓ |  |
| scheduled\_at | string | ✓ | now or future |

\[{  
  "client\_contact\_id": "cli-emp-551",  
  "recipient\_name": "คุณสมหญิง",  
  "recipient\_phone": "+66898765432",  
  "steps": \[  
    {  
      "type": "remind",  
      "message": "แจ้งเตือนนัดสัมภาษณ์พรุ่งนี้ 10:00 น.",  
      "scheduled\_at": "2026-07-01T14:00:00+07:00"  
    }  
  \]  
}\]

---

2. ### **Lumos ยิง API ไป Update ข้อมูล Reminder ให้ SO**    Schema ของข้อมูลผลลัพธ์การแจ้งเตือนที่ส่งไปให้

| Field | Type | Notes |
| :---- | :---- | :---- |
| plan\_id | string |  |
| step\_id | string |  |
| client\_contact\_id | string |  |
| title | string |  |
| recipient\_name | string |  |
| recipient\_phone | string |  |
| step\_position | integer | 0-based |
| step\_type | string | "remind" | "follow\_up" | "confirmation" |
| message | string |  |
| scheduled\_at | string | ISO 8601 |
| language | string |  |
| tone | string |  |
| status | string | "completed" | "failed" | "cancelled" |
| outcome | string |  |
| summary | string | null |  |
| transcript | object\[\] | { "role": "agent" | "candidate", "text": string } |
| recording\_url | string | null |  |
| call\_attempts | integer |  |
| ended\_reason | string | null |  |
| plan\_status | string | "active" | "completed" | "cancelled" |
| stop\_early | boolean | true when confirmed cancels remaining steps |

**outcome:** confirmed, acknowledged, declined, reschedule\_requested, wrong\_person, no\_answer, busy, unresponsive, failed, cancelled

**ตัวย่างข้อมูล**

\[{  
  "plan\_id": "5c2a9e10-3f4b-4a2c-9d1e-abcdef012345",  
  "step\_id": "d1e2f3a4-5b6c-7d8e-9f01-234567890abc",  
  "client\_contact\_id": "cli-emp-551",  
  "title": "นัดสัมภาษณ์พรุ่งนี้",  
  "recipient\_name": "คุณสมหญิง",  
  "recipient\_phone": "+66898765432",  
  "step\_position": 0,  
  "step\_type": "remind",  
  "message": "แจ้งเตือนนัดสัมภาษณ์พรุ่งนี้ 10:00 น.",  
  "scheduled\_at": "2026-07-01T14:00:00+07:00",  
  "language": "th",  
  "tone": "professional",  
  "status": "completed",  
  "outcome": "confirmed",  
  "summary": "ผู้รับสายยืนยันว่าจะเข้าร่วมสัมภาษณ์ตามเวลานัด",  
  "transcript": \[  
    { "role": "agent", "text": "สวัสดีค่ะ ขอแจ้งเตือนนัดสัมภาษณ์พรุ่งนี้ 10:00 น." },  
    { "role": "candidate", "text": "รับทราบค่ะ" }  
  \],  
  "recording\_url": "https://storage.lumos.ai/recordings/d1e2f3a4.mp3?sig=...",  
  "call\_attempts": 1,  
   "ended\_reason": null,  
  "plan\_status": "completed",  
  "stop\_early": true  
}

