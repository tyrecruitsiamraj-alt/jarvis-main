# So Recruit → Lumos: API และ JSON ของเส้นจับคู่งาน (Match lane)

ฉบับวันที่ 2 ต.ค. 2569 · จาก So Recruit (บริษัท สยามราชธานี)

เอกสารนี้อธิบายว่าระบบ So Recruit ส่งอะไรไปหา Lumos ในเส้น **จับคู่งาน** (เจ้าหน้าที่เลือกคนจากบอร์ดหรือ iRecruit ให้ AI โทรหา) และเราต้องการผลกลับมาแบบไหน

- ค่า API key, connection id และโดเมนจริงไม่อยู่ในเอกสารนี้ เขียนเป็น `<...>` แทนทุกจุด
- ชื่อและเบอร์โทรในตัวอย่างเป็นข้อมูลปลอมทั้งหมด
- ไฟล์คู่กัน: `so-recruit-match-lane-sample-2569-10-02.json` (ตัวอย่าง body ที่ยิงได้ทันที)

---

## 1. สรุป

| เรื่อง | ค่า |
|---|---|
| ทิศทาง | So Recruit เป็นฝ่ายยิงไปหา Lumos (push) · ไม่ได้ใช้ทางที่ Lumos มาดึงคิวแล้ว |
| ช่องที่เส้นจับคู่ใช้ | **interview** (คนจาก iRecruit และคนจากเลนสรรหา) · **reminder** (คนของเราบนบอร์ด แจ้งงาน) |
| Method | `POST` |
| Auth | `Authorization: Bearer <API key ที่ Lumos ออกให้ So Recruit>` |
| Body | JSON **array** มี 1 record ต่อ 1 request |
| ส่งเมื่อไหร่ | ทันทีที่เจ้าหน้าที่กดส่ง · ถ้าส่งไม่ถึง ระบบส่งซ้ำทุก 60 วินาที ด้วย `Idempotency-Key` เดิม จนเลยเวลานัด 24 ชม. |
| ผลกลับ | Lumos ยิงกลับมาที่ `POST {So Recruit}/api/lumos/interview/results` และ `/api/lumos/reminder/results` |

---

## 2. Endpoint ฝั่ง Lumos ที่เราเรียก

| Method | Path | ใช้ทำอะไร |
|---|---|---|
| POST | `<LUMOS_BASE_URL>/api/public/v1/webhooks/<connection_id>/interviews` | ส่งสายสัมภาษณ์เบื้องต้น (ช่อง interview) |
| POST | `<LUMOS_BASE_URL>/api/public/v1/webhooks/<connection_id>/reminders` | ส่งสายแจ้งงาน (ช่อง reminder) |
| DELETE | `<LUMOS_BASE_URL>/api/public/v1/webhooks/<connection_id>/interviews/<client_interview_id>` | ยกเลิกสายสัมภาษณ์ที่ส่งไปแล้ว |
| DELETE | `<LUMOS_BASE_URL>/api/public/v1/webhooks/<connection_id>/reminders/<client_contact_id>` | ยกเลิกสายแจ้งงานที่ส่งไปแล้ว |

- ค่าใน path ทุกตัวผ่าน URL-encode
- ตอนนี้เส้นจับคู่ยังไม่ได้เรียก DELETE (ฝั่งเราจะเพิ่ม) ส่วนเส้นติดตามคนเริ่มงานใช้ DELETE `/reminders/...` อยู่ทุกวัน

---

## 3. Headers และตัวอย่าง request

```http
POST <LUMOS_BASE_URL>/api/public/v1/webhooks/<connection_id>/interviews
Content-Type: application/json
Authorization: Bearer <API key>
Idempotency-Key: interview-12345

[ { ...record 1 ตัว ตามข้อ 4.1... } ]
```

```http
POST <LUMOS_BASE_URL>/api/public/v1/webhooks/<connection_id>/reminders
Content-Type: application/json
Authorization: Bearer <API key>
Idempotency-Key: reminder-12346

[ { ...record 1 ตัว ตามข้อ 4.2... } ]
```

### `Idempotency-Key`

| กรณี | ค่าที่ส่ง |
|---|---|
| ส่งครั้งแรก และส่งซ้ำเพราะครั้งก่อนไปไม่ถึง | `interview-<เลขคิว>` / `reminder-<เลขคิว>` (ค่าเดิมทุกครั้ง) |
| โทรซ้ำรอบที่ n (n ≥ 2) เช่น รอบแรกไม่รับสาย | `interview-<เลขคิว>-r<n>` / `reminder-<เลขคิว>-r<n>` |

### คำตอบที่เราอ่าน

```json
{
  "status": "success",
  "code": 202,
  "accepted": 1,
  "results": [
    { "event_id": "<uuid>", "status": "pending", "client_interview_id": "…", "client_candidate_id": "…", "candidate_name": "…" }
  ]
}
```

- เรานับว่า **ส่งถึง** เมื่อได้ HTTP 2xx, body เป็น JSON, `status` ไม่ใช่ `failed` และ `accepted` ≥ 1 (ถ้ามี field นี้)
- ถ้าไม่ใช่ 2xx เราอ่านข้อความจาก `message` / `detail` / `error` เพื่อแสดงให้เจ้าหน้าที่
- ถ้าต่อไม่ติด (เครือข่าย) เราลองใหม่ในคำขอเดิมสูงสุด 5 ครั้ง (หน่วง 0.5 / 2 / 5 / 10 วินาที) ถ้าได้ 4xx/5xx จะไม่ลองใหม่ในคำขอเดิม แต่ตัวส่งซ้ำจะลองอีกในรอบถัดไป

---

## 4. JSON ที่ส่ง

### 4.1 ช่อง interview — สัมภาษณ์เบื้องต้น

```json
[
  {
    "client_candidate_id": "siamraj-sql:OPL6910001::ir-123456",
    "client_interview_id": "siamraj-sql:OPL6910001::ir-123456::interview",
    "candidate_name": "ตัวอย่าง ทดสอบ",
    "phone": "+66812345678",
    "admin_phone": "+66898765432",
    "position": "พนักงานขับรถ",
    "scheduled_at": "2026-10-02T03:15:00.000Z",
    "questions": [
      "สวัสดีครับ คุณตัวอย่าง ทดสอบ ผมติดต่อจากสยามราชธานีนะครับ ตอนนี้มีงานตำแหน่งพนักงานขับรถ ที่ บริษัท ตัวอย่าง จำกัด อยากเรียนเสนอ ขอเวลาสัก 2-3 นาที สนใจฟังรายละเอียดไหมครับ",
      "งานนี้ทำที่ คลังสินค้าบางนา กม.19 สะดวกเดินทางไปทำงานไหมครับ",
      "เวลาทำงาน จันทร์-เสาร์ 08.00-17.00 น. สะดวกไหมครับ",
      "เคยทำงานตำแหน่งพนักงานขับรถ หรืองานใกล้เคียงมาก่อนไหมครับ",
      "ทางหน่วยงานอยากให้เริ่มงานประมาณวันที่ 15 ต.ค. 2569 สะดวกไหมครับ ถ้าไม่ทันเริ่มได้เร็วสุดวันไหนครับ",
      "ค่าแรงหรือเงินเดือนที่คาดหวังประมาณเท่าไหร่ครับ",
      "ถ้ายังไม่สนใจงานนี้ ขอทราบเหตุผลสั้น ๆ ได้ไหมครับ เช่น ค่าตอบแทนน้อยไป หรือ ที่ทำงานไกล หรือ ได้งานอื่นแล้ว หรือ เวลาทำงานไม่สะดวก หรือ งานไม่ตรงกับที่ทำ",
      "ถ้าสนใจ เดี๋ยวเจ้าหน้าที่จะติดต่อกลับไปนัดหมายและขอเอกสารสมัครงานนะครับ ขอบคุณที่สละเวลาครับ"
    ],
    "type": "phone",
    "language": "th",
    "tone": "professional",
    "skills": ["พนักงานขับรถ", "คนขับรถผู้บริหาร"],
    "priority": "high"
  }
]
```

| field | type | บังคับ | ความหมาย |
|---|---|---|---|
| `client_candidate_id` | string | ✓ | รหัสของเรา `<รหัสใบขอ>::<รหัสคน>` · `ir-` = คนจาก iRecruit · `card-` = คนบนบอร์ดของเรา · **ใช้ค่านี้จับคู่ผลที่ส่งกลับ** และไม่เปลี่ยนตอนโทรซ้ำ |
| `client_interview_id` | string | ✓ | `<client_candidate_id>::interview` · รอบโทรซ้ำต่อท้าย `::r<n>` |
| `candidate_name` | string | ✓ | ชื่อ-นามสกุลผู้สมัคร |
| `phone` | string | ✓ | เบอร์ที่ให้ AI โทร รูปแบบ E.164 (`+66` ตามด้วย 9 หลัก) |
| `admin_phone` | string | – | เบอร์เจ้าหน้าที่ของใบขอนั้น ให้ AI โทรหาเมื่อติดต่อผู้สมัครไม่ได้ · ไม่มีเบอร์ = ไม่ส่ง field นี้ |
| `position` | string | ✓ | ตำแหน่งงาน |
| `scheduled_at` | string (ISO 8601) | ✓ | เวลาที่ให้โทร · ส่งครั้งแรกเป็นเวลาที่กดส่ง (รูป UTC `…Z`) · ส่งซ้ำ/โทรซ้ำเป็นรูป `+07:00` และอย่างน้อย 10 นาทีหลังเวลาที่ส่ง |
| `questions` | string[] | ✓ | บทสัมภาษณ์ ข้อละ 1 ประโยค (ปกติ 5–9 ข้อ ไม่เกิน 14 ข้อ) · ข้อแรกเป็นคำทักทาย ข้อท้ายเป็นคำลา |
| `type` | string | – | `phone` เสมอ |
| `language` | string | – | `th` เสมอ |
| `tone` | string | – | `professional` เสมอ |
| `skills` | string[] | – | ทักษะ/ตำแหน่งที่เคยทำ 1–2 ค่า · ไม่มีข้อมูล = ไม่ส่ง field นี้ |
| `priority` | `high` / `medium` / `low` | – | ส่งเฉพาะตอนเจ้าหน้าที่ระบุความเร่งด่วน |

- เราไม่ได้ส่ง `experience` และ `education`
- ลำดับ key ใน JSON อาจไม่ตรงกับตัวอย่าง

### 4.2 ช่อง reminder — แจ้งงานให้คนบนบอร์ดของเรา

```json
[
  {
    "client_contact_id": "siamraj-sql:OPL6910001::card-98765",
    "recipient_name": "ตัวอย่าง ทดสอบ",
    "recipient_phone": "+66812345678",
    "title": "แจ้งงาน พนักงานขับรถ — บริษัท ตัวอย่าง จำกัด",
    "language": "th",
    "tone": "professional",
    "steps": [
      {
        "type": "remind",
        "message": "สวัสดีครับ คุณตัวอย่าง ทดสอบ ติดต่อจากสยามราชธานีนะครับ ระบบคัดเลือกพบว่าคุณเหมาะกับงานตำแหน่งพนักงานขับรถ ที่ บริษัท ตัวอย่าง จำกัด เริ่มงาน 15 ต.ค. 2569 (ใบขอ OPL6910001) สถานที่ทำงาน คลังสินค้าบางนา กม.19 · เวลาทำงาน จันทร์-เสาร์ 08.00-17.00 น. หากสนใจ ทีมสรรหาจะติดต่อกลับไปนัดหมายรายละเอียดต่อไปครับ",
        "scheduled_at": "2026-10-02T03:15:00.000Z"
      }
    ]
  }
]
```

| field | type | บังคับ | ความหมาย |
|---|---|---|---|
| `client_contact_id` | string | ✓ | `<รหัสใบขอ>::card-<เลขการ์ด>` · รอบโทรซ้ำต่อท้าย `-r<n>` · **ใช้ค่านี้จับคู่ผลที่ส่งกลับ** |
| `recipient_name` | string | ✓ | ชื่อผู้รับสาย |
| `recipient_phone` | string | ✓ | เบอร์ E.164 |
| `title` | string | ✓ | `แจ้งงาน <ตำแหน่ง> — <หน่วยงาน>` |
| `language` / `tone` | string | – | `th` / `professional` |
| `steps[]` | object[] | ✓ | 1 step: `{ type: "remind", message, scheduled_at }` · `message` คือประโยคที่ให้ AI พูด |

---

## 5. ผลที่เราต้องการให้ Lumos ส่งกลับ

ทั้งสองเส้นต้องส่ง `Authorization: Bearer <API key ที่ So Recruit ออกให้ Lumos>` มาด้วย · body เป็น JSON array (ส่ง object เดียวก็รับ)

### 5.1 `POST {So Recruit}/api/lumos/interview/results`

| field | บังคับ | หมายเหตุ |
|---|---|---|
| `interview_id` | ✓ | รหัสฝั่ง Lumos |
| `client_candidate_id` | ✓ | ค่าที่เราส่งไป (ข้อ 4.1) |
| `outcome` | ✓ | หนึ่งใน `completed` · `declined` · `wrong_person` · `unresponsive` · `no_answer` · `busy` · `failed` — **ถ้ามีรายการไหนค่าไม่อยู่ในชุดนี้ ทั้งชุดจะได้ 400** |
| `status`, `scheduled_at`, `call_attempts`, `ended_reason`, `duration_min` | – | สถานะสาย |
| `summary`, `ai_score`, `confidence`, `strengths`, `concerns`, `score_rationale`, `failure_reason` | – | สรุปผลสัมภาษณ์ |
| `transcript` (`[{ role: "agent" | "candidate", text }]`), `recording_url` | – | บทสนทนาและเสียง |
| `next_action`, `interview_outcome_status`, `event_id`, `client_interview_id` | – | รับเก็บไว้ทั้งก้อน |

คำตอบ:
```json
{ "ok": true, "received": 1, "matched": 1, "persisted": 1, "failed": 0, "message": "Interview results accepted — matched 1/1 queue rows" }
```

### 5.2 `POST {So Recruit}/api/lumos/reminder/results`

| field | บังคับ | หมายเหตุ |
|---|---|---|
| `plan_id` | ✓ | รหัสแผนฝั่ง Lumos |
| `step_id` | ✓ | รหัส step ฝั่ง Lumos |
| `client_contact_id` | ✓ | ค่าที่เราส่งไป (ข้อ 4.2) · ถ้ามี `-r<n>` ต่อท้าย เราจับคู่ได้ |
| `status` | ✓ | `completed` · `failed` · `cancelled` |
| `outcome` | ✓ | `confirmed` · `acknowledged` · `declined` · `reschedule_requested` · `wrong_person` · `no_answer` · `busy` · `unresponsive` · `failed` · `cancelled` |

---

## 6. คำถามที่อยากให้ทีม Lumos ยืนยัน

1. ถ้าเรายกเลิกสายแล้วส่งใหม่ภายหลัง ด้วย `Idempotency-Key` และ `client_interview_id` ตัวเดิม Lumos จะสร้างสายใหม่ หรือตอบผลเดิมโดยไม่โทร
2. `scheduled_at` ที่ผ่านไปแล้วไม่กี่วินาที (รูป UTC `Z`) Lumos ถือว่า "โทรทันที" ใช่ไหม ทั้งช่อง interview และ reminder
3. ส่งได้สูงสุดกี่ record ต่อ 1 request
4. DELETE `/interviews/<client_interview_id>` และ `/reminders/<client_contact_id>` มีผลอย่างไรกับสายที่กำลังโทรอยู่ และกับรอบโทรซ้ำ (`::r<n>` / `-r<n>`)
5. `status` ในผลช่อง interview มีค่าได้กี่แบบ (ที่เราเห็นจริงมี `เสร็จสิ้น` และ `ล้มเหลว`)
6. `event_id` ในผลโทรคนละค่ากับ `event_id` ตอนตอบรับ push — สองค่านี้คืออะไร ใช้ไล่สถานะได้ไหม
7. มีบางสายที่ Lumos ตอบรับแล้วแต่ไม่มีผลกลับมาเกิน 24 ชม. เกิดจากอะไรได้บ้าง และควรตามอย่างไร
