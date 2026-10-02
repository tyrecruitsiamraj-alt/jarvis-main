# API และ JSON เส้นจับคู่ (Match lane) ที่ส่งไปหา Lumos — ฉบับ 2 ต.ค. 2569

> **ที่มาของข้อมูล**
> - อ่านโค้ดใน repo `/Users/nitinan/Desktop/jarvis-main` ทุก path ข้างล่างนับจาก root ของ repo
> - ตัวเลขในฐานได้จากการ SELECT บน production แบบอ่านอย่างเดียว เมื่อ 2 ต.ค. 2569 ไม่ได้แก้ไฟล์และไม่ได้เขียนลงฐานเลย
>
> **ความลับ:** ใส่แค่ชื่อตัวแปร env ไม่มีค่าจริงสักตัว
>
> **ข้อมูลคน:** ชื่อและเบอร์ทุกจุดเป็นค่าปลอมหรือปิดไว้แล้ว (`ตัวอย่าง ทดสอบ`, `+668XXXXXXXX`) ชื่อหน่วยงานลูกค้าในตัวอย่างจริงก็ปิดไว้เหมือนกัน
>
> **ส่งต่อให้ทีม Lumos:** ข้อ 1–4, ข้อ 6 และข้อ 7.4 ส่งได้เลย ส่วนที่มีป้าย 🔒 เป็นเรื่องฝั่งเรา ไม่ต้องส่งต่อ

**"เส้นจับคู่" นับอะไรบ้าง**
- นับแถวในคิว `lumos_dispatch_queue` ที่ `person_ref` ขึ้นต้นด้วย `card-` หรือ `ir-` และ `job_ref` ไม่ใช่ `follow` (`src/lib/officeTeam.ts:143-150`, `api/_lib/homeAiShareSql.ts:250`)
- แถว `app-` นับเป็นเลน public แม้คนจะกดส่งจากหน้าจับคู่ก็ตาม เช่น ปุ่ม "หาคนจากกองไม่สนใจ" หรือใบสนใจ so_recruit ในเลนสรรหา (`src/lib/officeTeam.ts:148`, `api/_lib/recruitLanePool.ts:159,174`)

---

## 1. สรุปสั้น

- **Endpoint:** แยกตามช่องของสาย
  - ช่อง interview → `POST {LUMOS_BASE_URL}/api/public/v1/webhooks/{LUMOS_CONNECTION_ID}/interviews` ใช้กับ `ir-` (iRecruit) และ `card-` ที่มาจากเลนสรรหา
  - ช่อง reminder → `POST …/reminders` ใช้กับ `card-` (คนของเราบนบอร์ด)
  - อ้างอิง `api/_lib/lumosPushClient.ts:305-363`, `api/_lib/lumosPushTracking.ts:58-62`
- **Method:** POST เท่านั้น เราเป็นฝ่ายยิงไปหา Lumos (push)
  - Lumos เลิกมาดึงคิวตั้งแต่ราว 20 ส.ค. 2569 (ในฐาน `max(delivered_at)` = 20 ส.ค. 11:01 น. · `api/_lib/lumosPushTracking.ts:4`)
  - ฟังก์ชันยกเลิก (DELETE) มีในโค้ด แต่ไม่มีที่ไหนเรียกใช้ (ข้อ 6)
- **Auth:** ส่ง 3 header ทุกครั้ง
  - `Authorization: Bearer <LUMOS_PUSH_API_KEY>`
  - `Content-Type: application/json`
  - `Idempotency-Key: <ช่อง>-<id แถวคิว>`
  - อ้างอิง `api/_lib/lumosPushClient.ts:204-208, 313-314, 345-346`, `api/_lib/lumosPushTracking.ts:56`
- **Body:** JSON array ที่มี **1 record ต่อ 1 request**
  - record นั้นคือ `payload` ที่เก็บไว้ในคิว ส่งไปตรงตัวไม่แก้อะไร
  - อ้างอิง `api/_lib/lumosPushClient.ts:312,344`, `api/_lib/lumosPushTracking.ts:88-90, 138-144`
- **ส่งตอนไหน:** ยิงทันทีหลังเข้าคิว แบบไม่รอผล (`void pushQueuedRows` · `api/_lib/lumosDispatch.ts:743-747, 812-815, 1084`)
  - มีตัวส่งซ้ำเบื้องหลังวนทุก 60 วินาทีอีกชั้น (`src/lib/lumosPushRetryPolicy.ts:30-38`)
  - โหมดอัตโนมัติของเส้นจับคู่ปิดอยู่ตอนนี้ (`board_match` และ `irecruit_search` = manual) สายจึงออกเฉพาะเมื่อมีคนกด
  - **ในฐานไม่มีแถวเส้นจับคู่ใหม่เลยตั้งแต่ 17 ส.ค. 2569**

---

## 2. Endpoint ที่เรียก

### 2.1 ขาออก: เราเรียก Lumos

| Method | Path | ใช้ทำอะไร | เส้นจับคู่ใช้ไหม | อ้างอิง |
|---|---|---|---|---|
| POST | `{LUMOS_BASE_URL}/api/public/v1/webhooks/{LUMOS_CONNECTION_ID}/interviews` | ส่งสายคัดกรองหรือสัมภาษณ์ (ช่อง interview) | **ใช้** กับ `ir-` และ `card-` จากเลนสรรหา | `api/_lib/lumosPushClient.ts:305-331` |
| POST | `{LUMOS_BASE_URL}/api/public/v1/webhooks/{LUMOS_CONNECTION_ID}/reminders` | ส่งสายแจ้งงาน (ช่อง reminder) | **ใช้** กับ `card-` คนของเรา | `api/_lib/lumosPushClient.ts:337-363` |
| DELETE | `…/webhooks/{LUMOS_CONNECTION_ID}/interviews/{client_interview_id}` | ยกเลิกสายสัมภาษณ์ที่ส่งไปแล้ว | มีฟังก์ชัน `cancelPushedInterview` แต่ไม่มีใครเรียก | `api/_lib/lumosPushClient.ts:371-388` |
| DELETE | `…/webhooks/{LUMOS_CONNECTION_ID}/reminders/{client_contact_id}` | ยกเลิกสายแจ้งงาน | ไม่ใช้ (มีแต่งานติดตามที่ใช้) | `api/_lib/lumosPushClient.ts:394-411`, `api/_lib/callFollowup.ts:374` |
| GET | `{LUMOS_BASE_URL}/api/public/v1/events/{event_id}` | ดูสถานะงานทีละตัว | ไม่มีใครเรียก | `api/_lib/lumosPushClient.ts:419-434` |
| GET | `{LUMOS_BASE_URL}/api/public/v1/events?status=&since=&limit=` | ดูรายการงาน | ไม่มีใครเรียก | `api/_lib/lumosPushClient.ts:439-463` |

- `connection_id` และ id ที่อยู่ใน path ผ่าน `encodeURIComponent` ทุกครั้ง (`api/_lib/lumosPushClient.ts:318, 350, 377, 400`)

### 2.2 ขาเข้า: Lumos เรียกเรา

ต้องส่ง `Authorization: Bearer <LUMOS_API_KEY>` มาด้วย ถ้าฝั่งเราไม่ได้ตั้งคีย์ไว้จะตอบ 503 (`api/_lib/lumos-auth.ts:16-39`)

| Method | Path | ใช้ทำอะไร | อ้างอิง |
|---|---|---|---|
| POST | `/api/lumos/interview/results` | ส่งผลสายช่อง interview กลับมา | `api/_handlers/registry.ts:163` |
| POST | `/api/lumos/reminder/results` | ส่งผลสายช่อง reminder กลับมา | `api/_handlers/registry.ts:165` |
| GET | `/api/lumos/interview/candidates` · `/api/lumos/reminder/contacts` | ทางดึงคิวแบบเก่า ยังเปิดอยู่แต่ Lumos ไม่ได้ใช้แล้ว | `api/_handlers/registry.ts:162,164` |

### 2.3 ตัวแปร env (มีแค่ชื่อ)

| env | ใช้ทำอะไร | อ้างอิง |
|---|---|---|
| `LUMOS_BASE_URL` | โดเมนของ Lumos (ระบบตัด `/` ท้ายออกให้) | `api/_lib/lumosPushClient.ts:40` |
| `LUMOS_CONNECTION_ID` | ค่าที่อยู่ใน path `/webhooks/{connection_id}/…` | `api/_lib/lumosPushClient.ts:41` |
| `LUMOS_PUSH_API_KEY` | คีย์ขาออก ใช้ตอนเราเรียก Lumos | `api/_lib/lumosPushClient.ts:42` |
| `LUMOS_API_KEY` | คีย์ขาเข้า ใช้ตอน Lumos เรียกเรา | `api/_lib/lumos-auth.ts:7-10` |
| `LUMOS_ADMIN_PHONE_OVERRIDE` | ใช้ช่วงทดสอบ บังคับให้ `admin_phone` เป็นเบอร์เดียวทั้งระบบ | `api/_lib/interviewAdminPhone.ts:13-27` |
| `LUMOS_PUSH_RETRY_*` (`ENABLED` / `INTERVAL_MS` / `STARTUP_MS` / `LIMIT` / `GIVE_UP_MIN` / `LEAD_MIN` / `STALE_MIN`) | ตั้งค่าตัวส่งซ้ำ | `src/lib/lumosPushRetryPolicy.ts:60-71` |
| `LUMOS_HTTP_LOG` (off / basic / full) · `LUMOS_HTTP_LOG_MAX_CHARS` | ระดับ log ของ HTTP ที่ยิงไป Lumos | `api/_lib/lumosHttpLog.ts:30-48` |

- 🔒 **ต้องตั้งครบ 3 ตัว** (`LUMOS_BASE_URL`, `LUMOS_CONNECTION_ID`, `LUMOS_PUSH_API_KEY`)
  - ขาดตัวไหนตัวหนึ่ง ระบบจะไม่ยิงและไม่จด `push_state` ด้วย (`api/_lib/lumosPushClient.ts:43`, `api/_lib/lumosPushTracking.ts:76,136`)
- 🔒 **ที่มาของค่า:** ตอน deploy ระบบซิงก์จาก GitHub Secrets ให้แค่ `LUMOS_API_KEY` ตัวเดียว (`.github/workflows/deploy.yml:47`)
  - อีก 3 ตัวของ push ต้องตั้งเองใน `.env` บนเซิร์ฟเวอร์
  - production ตั้งไว้แล้วจริง ดูได้จากที่มีแถว `pushed` อยู่ 74 แถว
  - `.env.local` บนเครื่อง dev ไม่มีตัวแปร `LUMOS_*` เลย เครื่อง dev จึงไม่ยิงไป Lumos

---

## 3. Headers และตัวอย่าง request เต็ม

โค้ดจริงยิงด้วย `fetch` (`api/_lib/lumosPushClient.ts:239`) คำสั่งข้างล่างเป็น curl ที่ให้ผลเท่ากัน

**ช่อง interview**
```bash
curl -X POST "$LUMOS_BASE_URL/api/public/v1/webhooks/$LUMOS_CONNECTION_ID/interviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <LUMOS_PUSH_API_KEY>" \
  -H "Idempotency-Key: interview-<queue_id>" \
  --data '[ { ...record 1 ตัว ตามข้อ 4.1... } ]'
```

**ช่อง reminder**
```bash
curl -X POST "$LUMOS_BASE_URL/api/public/v1/webhooks/$LUMOS_CONNECTION_ID/reminders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <LUMOS_PUSH_API_KEY>" \
  -H "Idempotency-Key: reminder-<queue_id>" \
  --data '[ { ...record 1 ตัว ตามข้อ 4.2... } ]'
```

### 3.1 `Idempotency-Key`

| กรณี | ค่า | อ้างอิง |
|---|---|---|
| ส่งครั้งแรก และส่งซ้ำเพราะครั้งก่อนไปไม่ถึง | `interview-<id>` / `reminder-<id>` ใช้ค่าเดิมทุกครั้ง | `api/_lib/lumosPushTracking.ts:56,99` |
| โทรซ้ำรอบที่ n (n ≥ 2) | `interview-<id>-r<n>` / `reminder-<id>-r<n>` | `api/_lib/lumosPushRetryWorker.ts:305-306, 561, 568` |

- `<id>` คือ `lumos_dispatch_queue.id`

### 3.2 การส่ง

- body เป็น array เสมอ แม้มีคนเดียว (`api/_lib/lumosPushClient.ts:312,344`)
- ส่ง 1 record ต่อ 1 request (`api/_lib/lumosPushTracking.ts:58-62`)
- คอมเมนต์ในโค้ดเขียนว่าส่งได้ "สูงสุด 200 ต่อ request" แต่ไม่มีโค้ดบังคับตัวเลขนี้ (`api/_lib/lumosPushClient.ts:303`)
- ในการเรียกครั้งเดียว ระบบวนส่งทีละแถว (`api/_lib/lumosPushTracking.ts:77`)
- แต่ผู้ใช้แต่ละคนเปิดการส่งแยกของตัวเอง และตัวส่งซ้ำก็วิ่งเป็นลูปของมันเอง **Lumos จึงอาจได้หลาย POST พร้อมกัน** (`api/_lib/lumosDispatch.ts:746, 814, 1084`, `api/_lib/lumosPushRetryWorker.ts:642-658`)

### 3.3 คำตอบที่เราคาดว่าจะได้

อ้างอิงชนิด `LumosPushResponse` (`api/_lib/lumosPushClient.ts:50-67`)
```json
{ "status": "success", "code": 202, "accepted": 1,
  "results": [ { "event_id": "<จาก Lumos>", "status": "pending",
    "client_interview_id": "…", "client_candidate_id": "…", "candidate_name": "…" } ] }
```

**เรานับว่าส่งถึงเมื่อ** (`api/_lib/lumosPushTracking.ts:101`, `api/_lib/lumosPushClient.ts:322-328`)
- ได้ HTTP 2xx และ body เป็น JSON
- **และ** `status` ไม่ใช่ `'failed'`
- **และ** ถ้า `accepted` เป็นตัวเลข ต้องมีค่าตั้งแต่ 1 ขึ้นไป ถ้าไม่มี `accepted` มาเลยก็นับว่าถึง
- ระบบไม่ได้ตรวจ `results[]` หรือ `event_id`

**ถ้าได้คำตอบที่ไม่ใช่ 2xx**
- อ่าน `message` / `detail` / `error` จาก body ถ้าไม่มีใช้ `HTTP <status>` แทน แล้วจดเป็น `push_failed` (`api/_lib/lumosPushClient.ts:294-297, 325, 357`)
- `push_error` เก็บได้ไม่เกิน 300 ตัวอักษร (`api/_lib/lumosPushTracking.ts:118`)

**ถ้าต่อไม่ติด** (`fetch` throw)
- ลองใหม่สูงสุด 5 ครั้ง หน่วง 0.5 / 2 / 5 / 10 วินาที (`api/_lib/lumosPushClient.ts:150-176, 216-291`)
- ได้ 4xx/5xx กลับมาจะ **ไม่ลองใหม่** ในคำขอเดิม
- ไม่ได้ตั้ง timeout เอง (`api/_lib/lumosPushClient.ts:239`)

**สิ่งที่ไม่ได้จด** 🔒
- เส้นจับคู่ไม่จด `event_id` ลงฐาน ที่จดมีแค่งานติดตาม (`api/_lib/lumosDispatch.ts:1821-1849`)
- ในฐาน แถวที่ไม่ใช่งานติดตามมี `push_event_id` เป็น 0 จาก 187 แถว

### 3.4 สถานะการส่งที่จดในคิว (`push_state`)

| จังหวะ | push_state | อ้างอิง |
|---|---|---|
| เริ่มยิง | `push_pending` | `api/_lib/lumosPushTracking.ts:91-97` |
| ส่งถึง | `pushed` (`status` ยังเป็น `pending` จนกว่าผลโทรจะกลับมา) | `api/_lib/lumosPushTracking.ts:104-111`, `migrations/123_lumos_push_tracking.sql:10` |
| ส่งไม่ถึง หรือ Lumos ไม่รับ | `push_failed` | `api/_lib/lumosPushTracking.ts:112-121` |
| เบอร์ถูกพัก หรือมีเจ้าหน้าที่ถือเบอร์ไว้ | `push_skipped` + `status='cancelled'` | `api/_lib/lumosPushRetryWorker.ts:211-220, 447-457` |
| ส่งไม่ถึงนานเกิน 24 ชม. | `push_gave_up` + `status='cancelled'` + `needs_human` | `api/_lib/lumosPushRetryWorker.ts:423-431` |
| ส่งถึงแล้วแต่ไม่มีผลกลับเกิน 24 ชม. | `push_gave_up` + `needs_human` (`status` ยังเป็น `pending`) | `api/_lib/lumosPushRetryWorker.ts:196-208` |

**ตัวส่งซ้ำ**
- ค่าเริ่มต้นคือวนทุก 60 วินาที หยิบได้ 25 แถวต่อรอบ และเลิกเมื่อเลยเวลาที่ควรโทรไปเกิน 24 ชม. (`src/lib/lumosPushRetryPolicy.ts:30-38`)
- ตอนส่งซ้ำ เปลี่ยนแค่เวลานัดเป็นรูป `+07:00` และนัดอย่างน้อย now + 10 นาที (`api/_lib/lumosPushRetryWorker.ts:458-462`, `src/lib/lumosPushRetryPolicy.ts:41, 82-86`)

---

## 4. JSON ที่ส่ง

### 4.1 ช่อง interview (`ir-` / `card-` จากเลนสรรหา)

ตัวอย่างนี้เป็น**ข้อมูลปลอม** กรณีกดส่งเองจาก `POST /api/lumos/dispatch` พร้อมระบุ priority และสร้าง payload ตอน 10:15 น. เวลาไทย ข้อความใน `questions` ได้จากการรันตัวประกอบบทจริงด้วยบทมาตรฐาน

```json
[
  {
    "client_candidate_id": "siamraj-sql:OPL6910001::ir-123456",
    "client_interview_id": "siamraj-sql:OPL6910001::ir-123456::interview",
    "candidate_name": "ตัวอย่าง ทดสอบ",
    "phone": "+668XXXXXXXX",
    "admin_phone": "+669XXXXXXXX",
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

- payload เก็บเป็น jsonb แล้วอ่านกลับออกมายิง ลำดับคีย์ที่ Lumos ได้จึงอาจไม่ตรงกับตัวอย่างนี้
- ชนิดข้อมูลฝั่งเราคือ `LumosInterviewPayload` (`api/_lib/lumosDispatch.ts:157-172`) และ `LumosPushInterviewRecord` (`api/_lib/lumosPushClient.ts:107-124`)

| field | type | บังคับ | ค่ามาจากไหน | อ้างอิง |
|---|---|---|---|---|
| `client_candidate_id` | string | ✓ | `<jobId>::<person_ref>` · ในฐานทุกแถวเป็น `siamraj-sql:<เลขที่ใบขอ>::…` (โค้ดรองรับ `siamraj-pre:` และ `siamraj:` ด้วย) · ใช้จับคู่ผลที่ส่งกลับ และไม่เปลี่ยนตอนโทรซ้ำ | `api/_lib/lumosDispatch.ts:198, 289`, `api/_lib/siamrajSqlServerRequests.ts:223`, `api/_lib/siamrajSqlServerPrequests.ts:100` |
| `client_interview_id` | string | ✓ | `<client_candidate_id>::interview` · รอบโทรซ้ำต่อท้าย `::r<n>` | `api/_lib/lumosDispatch.ts:199, 290`, `api/_lib/lumosPushRetryWorker.ts:291-294` |
| `candidate_name` | string | ✓ | ชื่อ + นามสกุลตามที่ต้นทางเก็บไว้ ไม่ได้ตัดหรือเติมคำนำหน้า · ถ้าว่างใช้ค่าแทน `ผู้สมัคร #<id>` / `ผู้สมัคร <id>` / `(ไม่ระบุชื่อ)` | `api/_handlers/lumos-dispatch.ts:289`, `api/_lib/callBatchDispatcher.ts:100`, `api/_lib/irecruitCandidateMatcher.ts:123-125`, `api/_lib/recruitLanePool.ts:123,160` |
| `phone` | string (E.164 `+66…`) | ✓ | `toE164Thai()` รับเลข 10 หลักที่ขึ้นต้นด้วย 0 หรือ 11 หลักที่ขึ้นต้นด้วย 66 · แปลงไม่ได้ = ไม่เข้าคิว | `api/_lib/thaiPhone.ts:12-18`, `api/_lib/lumosDispatch.ts:181-182` |
| `admin_phone` | string | – | เบอร์เจ้าหน้าที่ที่ AI โทรหาเมื่อติดต่อผู้สมัครไม่ได้ · ใส่ตอนเข้าคิว ไม่ได้มาจากตัวประกอบ payload · ลำดับการหา: env override → เจ้าหน้าที่สรรหาของใบขอ → เจ้าหน้าที่คัดสรร → สุ่ม supervisor → หาไม่ได้ก็ไม่ใส่ field นี้ · ทั้งรอบที่ส่งใช้เบอร์เดียวกัน | `api/_lib/lumosDispatch.ts:81-89, 778, 1042`, `api/_lib/interviewAdminPhone.ts:23-73` |
| `position` | string | ✓ | `job_description_code_1` + `_2` → `staff_title_name` → `job_family_label` → `'ตามใบขอ'` | `api/_lib/lumosDispatch.ts:92-96` |
| `scheduled_at` | string (ISO) | ✓ | เวลาตอนประกอบ payload ในรูป UTC `…Z` · ส่งครั้งแรกใช้ค่านี้ตรงตัว · ส่งซ้ำหรือโทรซ้ำเปลี่ยนเป็นรูป `+07:00` | `api/_lib/lumosDispatch.ts:203, 294`, `api/_lib/lumosPushRetryWorker.ts:458-462, 562` |
| `questions` | string[] | ✓ | บท "สัมภาษณ์เบื้องต้น" บทมาตรฐานได้ 7–9 ข้อ ตัดที่ 14 ข้อ · แก้บทได้จากหน้าตั้งค่า (`call_script_overrides`) | `api/_lib/lumosCallScript.ts:48, 276-278`, `api/_lib/lumosCallScript.templates.ts:78-89`, `api/_lib/callScriptStore.ts:27` |
| `type` / `language` / `tone` | string | – | ค่าคงที่ `phone` / `th` / `professional` | `api/_lib/lumosDispatch.ts:213-215, 305-307` |
| `skills` | string[] | – | iRecruit ที่ติ๊กหรือค้นแล้วส่ง ได้สูงสุด 2 ค่า · เลนสรรหาได้ 1 ค่า · ไม่มีข้อมูลก็ไม่ใส่ | `api/_lib/lumosDispatch.ts:185-187, 287`, `api/_lib/recruitLanePool.ts:125` |
| `priority` | `high` \| `medium` \| `low` | – | มีเฉพาะ `POST /api/lumos/dispatch` ฝั่ง `irecruitIds` ที่ระบุ priority มา · ทางอัตโนมัติและชุดโทรไม่มี | `api/_handlers/lumos-dispatch.ts:163-167, 294`, `api/_lib/lumosDispatch.ts:217` |
| `experience` / `education` | object[] | – | มีในชนิดข้อมูล แต่**ไม่มีตัวประกอบ payload ตัวไหนใส่ค่า** | `api/_lib/lumosPushClient.ts:122-123` |

### 4.2 ช่อง reminder (`card-` คนของเราบนบอร์ด)

```json
[
  {
    "client_contact_id": "siamraj-sql:OPL6910001::card-98765",
    "recipient_name": "ตัวอย่าง ทดสอบ",
    "recipient_phone": "+668XXXXXXXX",
    "title": "แจ้งงาน พนักงานขับรถ — บริษัท ตัวอย่าง จำกัด",
    "language": "th",
    "tone": "professional",
    "steps": [
      { "type": "remind",
        "message": "สวัสดีครับ คุณตัวอย่าง ทดสอบ ติดต่อจากสยามราชธานีนะครับ ระบบคัดเลือกพบว่าคุณเหมาะกับงานตำแหน่งพนักงานขับรถ ที่ บริษัท ตัวอย่าง จำกัด เริ่มงาน 15 ต.ค. 2569 (ใบขอ OPL6910001) สถานที่ทำงาน คลังสินค้าบางนา กม.19 · เวลาทำงาน จันทร์-เสาร์ 08.00-17.00 น. หากสนใจ ทีมสรรหาจะติดต่อกลับไปนัดหมายรายละเอียดต่อไปครับ",
        "scheduled_at": "2026-10-02T03:15:00.000Z" }
    ]
  }
]
```

| field | type | ค่ามาจากไหน | อ้างอิง |
|---|---|---|---|
| `client_contact_id` | string | `<jobId>::card-<card_id>` · รอบโทรซ้ำต่อท้าย `-r<n>` | `api/_lib/lumosDispatch.ts:131`, `api/_lib/lumosPushRetryWorker.ts:295-306` |
| `recipient_name` | string | ชื่อบนการ์ด · ถ้าว่างใช้ `การ์ด #<id>` / `การ์ด <id>` | `api/_handlers/lumos-dispatch.ts:74-80`, `api/_lib/callBatchDispatcher.ts:56-59` |
| `recipient_phone` | string (E.164) | `toE164Thai()` | `api/_lib/lumosDispatch.ts:121-122` |
| `title` | string | `แจ้งงาน <ตำแหน่ง> — <หน่วยงาน>` | `api/_lib/lumosDispatch.ts:130-154` |
| `language` / `tone` | string | `th` / `professional` | `api/_lib/lumosDispatch.ts:130-154` |
| `steps[]` | object[] (1 ตัว) | `{type:'remind', message, scheduled_at}` · `message` มาจากบท "แจ้งงาน" ซึ่ง**แก้จากหน้าตั้งค่าไม่ได้** · ส่งซ้ำจะแก้แค่ `steps[].scheduled_at` | `api/_lib/lumosCallScript.ts:307-319`, `api/_lib/lumosCallScript.templates.ts:113-120`, `api/_lib/lumosPushRetryWorker.ts:267-276` |

- ช่องนี้**ไม่มี `admin_phone` และไม่มี `priority`** ทั้งที่ชนิดข้อมูลของ push รองรับไว้ (`api/_lib/lumosDispatch.ts:686-749`, `api/_lib/lumosPushClient.ts:135-146`)

### 4.3 สิ่งที่ "ไม่มี" ใน JSON ที่ push ตอนนี้

- **ไม่มีประโยครายได้และสวัสดิการ** เช่น `"แจ้งเพิ่มเติมครับ งานนี้รายได้ประมาณ … บาทต่อเดือน …"`
  - ทั้ง repo เติมประโยคนี้ที่เดียว คือตอนที่ Lumos มาดึงคิว (`takePendingLumosItems` · `api/_lib/lumosDispatch.ts:2806-2829`)
  - ทาง push ไม่ได้เรียกจุดนั้น (`api/_lib/lumosPushTracking.ts:69-149`)
- **ไม่มีการเลื่อนเวลาให้เป็นอนาคตตอนส่งครั้งแรก** ทางดึงคิวเคยแปลงเวลาเป็น `+07:00` และดันไปอย่างน้อย now + 10 นาทีให้ (`api/_lib/lumosDispatch.ts:2600-2618, 2831`) แต่ทาง push รอบแรกส่งเวลาเดิมที่เก็บไว้
- **คอลัมน์ภายในไม่ได้ส่งไป:** `script_key`, `script_source`, `script_fingerprint`, `match_rank`, `job_ref`, `person_ref`, `next_attempt_at` (`api/_lib/lumosDispatch.ts:477-478, 497-517, 634-644`)

---

## 5. ทางเข้าของเส้นจับคู่บนระบบเรา

| ปุ่มหรือที่มา | route ของเรา | ฟังก์ชันเข้าคิว | ตัวประกอบ payload | ช่อง / ref |
|---|---|---|---|---|
| หน้าจับคู่งาน "ส่งทั้งหมดที่แมท (N)" → "ยืนยันส่ง" · "เลือกคนส่ง AI โทร" → "ถัดไป" · แท็บ AI Match ของใบขอ | `POST /api/lumos/dispatch` | `enqueueLumosReminderForSelected` (`boardCardIds`) | `buildReminderPayload` (`api/_lib/lumosDispatch.ts:115-155`) | reminder / `card-` |
| ปุ่มเดียวกัน ฝั่งคนจาก iRecruit | `POST /api/lumos/dispatch` | `enqueueLumosInterviewForSelected` (`irecruitIds`) | `buildInterviewPayload` (`api/_lib/lumosDispatch.ts:174-219`) | interview / `ir-` |
| "ตั้งคิวโทร (N)" | `POST /api/lumos/call-batches` → ตัวส่งซ้ำปล่อยชุดหลังผ่านไป 10 นาที | `callBatchDispatcher` → ฟังก์ชัน `*ForSelected` 2 ตัวข้างบน (`api/_lib/callBatchDispatcher.ts:46-108`) | เหมือน 2 แถวบน | reminder `card-` / interview `ir-` |
| "ให้ AI โทรหาคนที่ยังไม่สมัคร" | `GET /api/matching/irecruit-candidates?jobId=&send=1` | `enqueueLumosInterviewForIrecruit` (`api/_lib/lumosDispatch.ts:854-893`) | `buildInterviewPayload` | interview / `ir-` |
| กล่องงาน "หาคนทุกกอง + ให้ AI โทร" | `GET /api/matching/recruit-lane?jobId=&send=1` | `enqueueLumosInterviewForRecruitLane` (`api/_lib/lumosDispatch.ts:970-1101`) | `buildRecruitLaneInterviewPayload` (`api/_lib/lumosDispatch.ts:275-310`) | interview / `ir-` · `card-` (Checklist) · `app-` (นับเป็น public) |
| อัตโนมัติ `board_match` (**ปิดอยู่**) | ภายในระบบ | `enqueueLumosReminderForBoardMatch` (`api/_lib/boardCandidateMatcher.ts:354-356`) | `buildReminderPayload` | reminder / `card-` |
| อัตโนมัติ `irecruit_search` (**ปิดอยู่**) | `GET irecruit-candidates` ทุกครั้งที่เรียก | `enqueueLumosInterviewForIrecruit` | `buildInterviewPayload` | interview / `ir-` |
| (ไว้เทียบ) "หาคนจากกองไม่สนใจ" | `GET /api/matching/selection-recall?send=1` | `enqueueLumosInterviewForRecall` | `buildRecallInterviewPayload` (`api/_lib/lumosDispatch.ts:900-938`) | interview / `app-` → **ไม่นับเป็นเส้นจับคู่** |

**ทุกทางผ่านจุดเดียวกัน**
- ทุกทางเข้าคิวผ่าน `insertQueueItems()` (`api/_lib/lumosDispatch.ts:519-664`)
- ด่านที่นี่กันเบอร์ที่เจ้าหน้าที่ถือไว้ เบอร์ที่ถูกพัก และเบอร์ที่เคยปฏิเสธหน่วยงานนี้ (`api/_lib/lumosDispatch.ts:602-623`)
- กันส่งซ้ำด้วย unique `(channel, job_ref, person_ref)` (`api/_lib/lumosDispatch.ts:17, 436-438`)
- ฟังก์ชัน `*ForSelected` ยิงทันทีเฉพาะเมื่อผู้เรียกส่ง `autoPush: true` ซึ่งตอนนี้ผู้เรียกทุกตัวส่งค่านี้ (`api/_handlers/lumos-dispatch.ts:262,295`, `api/_lib/callBatchDispatcher.ts:79,106`)

**โหมดบน production** (ตาราง `app_lumos_dispatch_mode` แก้ล่าสุด 18 ส.ค. 2569)
- `board_match=manual` · `irecruit_search=manual` · `selection_recall=manual` · `follow_entry=auto`
- ทาง `send=1` ของสองเส้นค้นหาไม่ได้ดูโหมดนี้ จึงยิงได้เสมอ (`api/_handlers/matching-irecruit-candidates.ts:63-65`, `api/_handlers/matching-recruit-lane.ts:61-64`)

**JSON ที่หน้าจอส่งเข้า `POST /api/lumos/dispatch`**
- ใช้ session + สิทธิ์ `lumos-dispatch` ไม่ได้ใช้คีย์ Lumos (`api/_handlers/lumos-dispatch.ts:137-170, 366`)
```json
{ "jobId": "siamraj-sql:<เลขที่ใบขอ>", "boardCardIds": [12345], "irecruitIds": [67890], "priority": "high" }
```
- id ต้องเป็นจำนวนเต็มบวก และส่งได้ไม่เกิน 50 คนต่อครั้ง (`api/_handlers/lumos-dispatch.ts:42, 127-161`)
- ชื่อและเบอร์ เซิร์ฟเวอร์อ่านจากฐานเองทั้งหมด ไม่รับจากหน้าจอ (`api/_handlers/lumos-dispatch.ts:8-9`)
- ตอบ `{ queued, duplicated[], skipped[{ref,name,reason}], items[] }` และตอบกลับก่อนที่ push จะเสร็จ (`api/_handlers/lumos-dispatch.ts:300-318`)

🔒 **ปุ่ม "ส่ง AI โทร (ติ๊ก N)" น่าจะพังมาตั้งแต่ 13 ส.ค. 2569** (ข้อนี้มาจากการอ่านโค้ด ยังไม่ได้กดทดสอบในเบราว์เซอร์)
- ปุ่มผูกไว้แบบ `onSend={beginSendFlow}` + `onClick={onSend}` React จึงส่ง click event เข้าไปแทนรายการ id แล้วระบบโยน TypeError (`src/pages/matching/MatchingPage.tsx:3748, 1199-1201`, `src/components/matching/LumosPanels.tsx:302`)
- ตรงกับในฐานที่ไม่มี audit `lumos.dispatch.manual` เลยสักแถว

---

## 6. การยกเลิกสาย และผลที่ Lumos ส่งกลับ

### 6.1 ยกเลิก

**ตอนนี้กดยกเลิกแล้วไปไม่ถึง Lumos**
- ปุ่ม "ยกเลิก" เรียก `DELETE /api/lumos/dispatch?jobId=&channel=&ref=` (`api/_handlers/lumos-dispatch.ts:321-352`)
- ตัวที่ทำงานจริงคือ `cancelLumosQueueItem` ซึ่ง**แก้แค่ฐานของเรา** เป็น `status='cancelled'` (`api/_lib/lumosDispatch.ts:1427-1441`)
- ระบบไม่ได้ยิง DELETE ไป Lumos ถ้าสายถูก push ไปแล้ว AI ยังโทรได้ตามปกติ

🔒 **ผลที่มาทีหลังปลุกแถวที่ยกเลิกแล้วกลับขึ้นมา**
- การบันทึกผลไม่กรองสถานะ จึงเขียนทับ `cancelled` ได้ (`api/_lib/lumosDispatch.ts:2861-2871`)
- ถ้าผลเป็น "ไม่รับสาย" ระบบตั้งโทรซ้ำ (`api/_lib/callFollowup.ts:191-199`) แล้วตัวส่งซ้ำ push รอบใหม่ (`api/_lib/lumosPushRetryWorker.ts:181-190, 563-569`)

**ถ้าจะยกเลิกที่ Lumos จริง** ต้องเรียก
- `DELETE …/interviews/{client_interview_id}` (รอบโทรซ้ำต้องต่อท้าย `::r<n>`)
- `DELETE …/reminders/{client_contact_id}` (รอบโทรซ้ำต้องต่อท้าย `-r<n>`)

**ส่งใหม่หลังยกเลิก**
- ระบบปลุกแถวเดิมกลับมาใช้ (id เดิม) จึงได้ `Idempotency-Key` และ `client_interview_id` ตัวเดิม
- ระบบรีเซ็ต `attempt_count=1` ด้วย คีย์ของรอบโทรซ้ำ `…-r2` จึงซ้ำกับของเดิมอีก (`api/_lib/lumosDispatch.ts:432-441`)
- คอมเมนต์ในโค้ดบันทึกไว้ว่าที่ Lumos "คีย์เดิม = ผลเดิม" (`api/_lib/lumosPushTracking.ts:9-10`)

### 6.2 ผลที่ Lumos ส่งกลับ

**ช่อง interview: `POST /api/lumos/interview/results`**
- จับคู่กลับด้วย `client_candidate_id` รอบโทรซ้ำไม่ได้เปลี่ยนค่านี้ จึงจับแถวเดิมได้ (`api/_handlers/lumos-interview.ts:384-393`, `api/_lib/lumosDispatch.ts:2847`)
- แปลงสถานะลงคิว: `outcome=completed` → `completed` · `status='ยกเลิก'` → `cancelled` · กรณีอื่นทั้งหมด → `failed` (`api/_handlers/lumos-interview.ts:385-386`)
- `outcome` ต้องเป็น 1 ใน 7 ค่า: completed / declined / wrong_person / unresponsive / no_answer / busy / failed ถ้าไม่ใช่ **ทั้งชุดจะได้ 400** (`api/_handlers/lumos-interview.ts:193-207, 351-357`)
- ผลเก็บดิบทั้งก้อนลง `lumos_dispatch_queue.result` (`api/_lib/lumosDispatch.ts:2862-2872`)

**ช่อง reminder: `POST /api/lumos/reminder/results`**
- จับคู่ด้วย `client_contact_id` ถ้าไม่เจอ ระบบลองตัด `-r<n>` ท้ายออกแล้วหาใหม่ (`api/_lib/lumosDispatch.ts:2916-2917`)

---

## 7. ตัวอย่างจริงจากคิว และจุดที่เอกสารเก่าไม่ตรงของจริง

### 7.1 สภาพคิวจริง (นับรวม ณ 2 ต.ค. 2569)

| กลุ่ม | แถว | สถานะ | หมายเหตุ |
|---|---|---|---|
| เส้นจับคู่ interview `card-` | 40 | ยกเลิก 16 · delivered 23 · failed 1 | สร้าง 16–17 ส.ค. 2569 |
| เส้นจับคู่ interview `ir-` | 19 | ยกเลิก 3 · delivered 14 · completed 2 | สร้าง 17 ส.ค. 2569 |
| เส้นจับคู่ reminder `card-` | **0** | – | ในฐานตอนนี้ไม่มีแถวเหลือ |
| (เทียบ) interview `app-` | 128 | ทาง push: `pushed` 74 · `push_gave_up` 9 | 20 ส.ค. – 2 ต.ค. |

**แถวเส้นจับคู่ 59 แถวเป็นของยุคที่ Lumos มาดึงคิว**
- `push_state` เป็น null ทุกแถว และ `delivery_count` อยู่ที่ 3–5
- ไม่มี `admin_phone` เพราะโค้ดเพิ่ม field นี้ภายหลัง และไม่มี `script_key`

**แถว delivered 37 แถว**
- โทรจริงแล้วทุกแถว (มี `first_result_at`)
- ต่อมา migration 127 ปิดเป็น `closed` เมื่อ 29 ก.ย. 2569 เพราะรอบโทรซ้ำไม่มีผลกลับมา (`migrations/127_close_stale_match_retries_2569_09_29.sql:1-19`)

**แถวที่หายไป**
- แถวก่อน id 16595 (ก่อน 16 ส.ค.) ถูกล้างออกจากตารางแล้ว
- ไฟล์สำรองในเครื่องบอกว่าเคยมี reminder `card-` 5,280 แถวในยุคดึงคิว
- ⇒ **ช่อง reminder ของเส้นจับคู่ยังไม่มีหลักฐานว่าเคยถูกส่งทาง push สักครั้ง** ส่วน endpoint `/reminders` เองใช้งานได้ เพราะงานติดตามยิงผ่านทุกวัน

**ทางขนส่งช่อง interview ใช้ได้จริงบน production**
- แถว `app-` 41 แถวได้ผลโทรกลับหลัง push ครั้งเดียว ทั้งที่ส่ง `scheduled_at` เป็น UTC `Z`

### 7.2 ตัวอย่าง payload จริง: `ir-` (queue id 16686)

- ใบขอ `siamraj-sql:DSO6809001` · status `completed` · match_rank 1 · สร้าง 2026-08-17T04:40:03Z
- ปิดชื่อ เบอร์ id หน่วยงานลูกค้า และสถานที่ไว้แล้ว ลำดับคีย์เป็นแบบที่ jsonb จัดเอง

```json
{
  "tone": "professional",
  "type": "phone",
  "phone": "+668XXXXXXXX",
  "skills": ["ผู้ประสานงาน"],
  "language": "th",
  "position": "ผู้ประสานงาน",
  "questions": [
    "สวัสดีครับ คุณตัวอย่าง ทดสอบ ผมติดต่อจากสยามราชธานีนะครับ ตอนนี้มีงานตำแหน่งผู้ประสานงาน ที่ <หน่วยงานลูกค้า> อยากเรียนเสนอ ขอเวลาสัก 2-3 นาที สนใจฟังรายละเอียดไหมครับ",
    "งานนี้ทำที่ <สถานที่ทำงาน> สะดวกเดินทางไปทำงานไหมครับ",
    "เวลาทำงาน วันจันทร์-วันอาทิตย์ 10.00-19.00 น. สะดวกไหมครับ",
    "เคยทำงานตำแหน่งผู้ประสานงาน หรืองานใกล้เคียงมาก่อนไหมครับ",
    "ทางหน่วยงานอยากให้เริ่มงานประมาณวันที่ 1 ส.ค. 2568 สะดวกไหมครับ ถ้าไม่ทันเริ่มได้เร็วสุดวันไหนครับ",
    "ค่าแรงหรือเงินเดือนที่คาดหวังประมาณเท่าไหร่ครับ",
    "ถ้ายังไม่สนใจงานนี้ ขอทราบเหตุผลสั้น ๆ ได้ไหมครับ เช่น ค่าตอบแทนน้อยไป หรือ ที่ทำงานไกล หรือ ได้งานอื่นแล้ว หรือ เวลาทำงานไม่สะดวก หรือ งานไม่ตรงกับที่ทำ",
    "ถ้าสนใจ เดี๋ยวเจ้าหน้าที่จะติดต่อกลับไปนัดหมายและขอเอกสารสมัครงานนะครับ ขอบคุณที่สละเวลาครับ"
  ],
  "scheduled_at": "2026-08-17T04:40:03.627Z",
  "candidate_name": "ตัวอย่าง ทดสอบ",
  "client_candidate_id": "siamraj-sql:DSO6809001::ir-XXXXXX",
  "client_interview_id": "siamraj-sql:DSO6809001::ir-XXXXXX::interview"
}
```

**ข้อสังเกตจากตัวอย่างนี้** 🔒
- ข้อ 5 พูดวันเริ่มงาน "1 ส.ค. 2568" ซึ่งผ่านไปแล้ว เพราะดึงมาจาก `required_date` ของใบขอเก่า
- ตัวอย่างที่สอง (queue id 16662 · `card-` จาก Checklist · ใบ `siamraj-sql:LBM6908002` · ผล declined) ใช้รูปเดียวกันทุกอย่าง มี `skills` 1 ค่า
- แถวรุ่น 16 ส.ค. มีแค่ 6 ข้อ และไม่มีคำทักทาย
- บางแถวมีคำว่า "ไม่ระบุ" ติดมาใน `skills` เพราะตัวรวมข้อความของเลนสรรหาไม่ได้กรองคำนี้ (`api/_lib/recruitLanePool.ts:93-97, 217`)

**ค่าที่เหมือนกันทุกแถว interview (187/187)**
- `type/language/tone` = `phone/th/professional`
- `phone` เป็น `+66` ตามด้วย 9 หลัก
- `client_candidate_id = <job_ref>::<person_ref>`
- `scheduled_at` เป็น UTC `Z` และห่างจากเวลาเข้าคิวไม่เกิน 5 วินาที

### 7.3 ผลที่ Lumos ส่งกลับจริง (queue id 16686 · ย่อและปิดข้อมูลแล้ว)

```json
{
  "status": "เสร็จสิ้น",
  "outcome": "completed",
  "interview_outcome_status": "interested",
  "ai_score": 55,
  "confidence": "medium",
  "duration_min": 8,
  "call_attempts": 1,
  "ended_reason": "assistant_closing_no_tool",
  "event_id": "<uuid>",
  "interview_id": "<uuid>",
  "scheduled_at": "2026-08-19T03:00:00+00:00",
  "questions": "<array 9 ข้อ = 8 ข้อในฐาน + ประโยครายได้ที่เติมตอนดึงคิว>",
  "transcript": "<array {role,text} — ตัดออก>",
  "next_action": { "type": "next_interview_requested", "due_at": null, "reason": "<ตัดออก>", "urgency": "normal" },
  "summary": "<ตัดออก>", "strengths": ["<ตัดออก>"], "concerns": ["<ตัดออก>"],
  "score_rationale": "<ตัดออก>", "failure_reason": null, "recording_url": "<ตัดออก>",
  "candidate_name": "ตัวอย่าง ทดสอบ", "phone": "+668XXXXXXXX", "position": "ผู้ประสานงาน",
  "type": "phone", "language": "th", "tone": "professional",
  "client_candidate_id": "siamraj-sql:DSO6809001::ir-XXXXXX",
  "client_interview_id": "siamraj-sql:DSO6809001::ir-XXXXXX::interview",
  "external_interview_id": null
}
```

- ผลมีทั้งหมด 29 คีย์ เจอชุดเดียวกันทั้งในเส้นจับคู่และ `app-`
- ค่าที่เจอจริงในฐาน:
  - `status` มีแค่ `เสร็จสิ้น` / `ล้มเหลว`
  - `outcome`: completed · declined · no_answer · unresponsive · busy
  - `confidence`: low / medium / null
  - `ended_reason` มีทั้งรหัส และข้อความ error ดิบ เช่น SIP 480/486 หรือ `twirp error …`
- **ผลกับสถานะบนจออาจขัดกัน:** ตัวอย่าง B ได้ `status=เสร็จสิ้น` + `outcome=declined` แต่แถวในคิวกลายเป็น `failed` เพราะกติกาการแปลงในข้อ 6.2

### 7.4 ยุคดึงคิวกับยุค push: สิ่งที่ Lumos ได้รับไม่เท่ากัน

| ยุค | สิ่งที่ Lumos ได้ | หลักฐาน |
|---|---|---|
| ดึงคิว (ถึงราว 20 ส.ค.) | payload + ข้อสุดท้ายเป็นประโยครายได้ + `scheduled_at` รูป `+07:00` ที่ดันไปอย่างน้อย now + 10 นาที | แถวเส้นจับคู่ที่มีผล 3/3 แถว: ในฐานมี 8 ข้อ แต่ `result.questions` มี 9 ข้อ (`api/_lib/lumosDispatch.ts:2806-2831`) |
| push (ตอนนี้) | payload ในฐานตรงตัว **ไม่มีประโยครายได้** · `scheduled_at` เป็น UTC `Z` | แถว `app-` ที่มีผล 105/105 แถว: ส่ง 5 ข้อ ได้กลับ 5 ข้อ (`api/_lib/lumosPushTracking.ts:88-90`) |

### 7.5 จุดที่ `docs/lumos-api.md` และ Postman ไม่ตรงกับของจริง

**1. ไม่มีทาง push เลย**
- `docs/lumos-api.md` และ `docs/SO Jarvis x Lumos.postman_collection.json` บรรยายเฉพาะ endpoint ฝั่งเราที่ Lumos เรียกเข้ามา คือ positions, interview/candidates, interview/results, reminder/contacts และ reminder/results (`docs/lumos-api.md:3-4, 39, 124, 201, 293, 355`)
- ไม่มี `/api/public/v1/webhooks/…` และ `/events` สักบรรทัด มีพูดถึงแค่ในเอกสารภายใน (`.claude/skills/request-control-tower-advisor/references/09-editing-map.md:10015`)

**2. รูป body ไม่ตรง**
- ของจริง push เป็น array `[ {...} ]`
- ตัวอย่างใน docs เป็น `{ok, data:[…], total}` ซึ่งเป็นรูปคำตอบของทางดึงคิว

**3. field ใน payload ช่อง interview**

| field | ของจริง | docs / Postman |
|---|---|---|
| `admin_phone` | ใส่เมื่อหาเบอร์ได้ (`app-` มี 127/128 แถว) | ไม่มี |
| `priority` | มีในชนิดข้อมูล แต่ในฐานยังไม่พบสักแถว | ไม่มี |
| `experience` / `education` | ไม่เคยส่ง | มี (`docs/lumos-api.md:154-174, 196-197`) |
| `client_candidate_id` | `<job_ref>::<person_ref>` | "SO candidate ID" (`:185`) / Postman ใช้ `cli-cand-…` |
| `scheduled_at` | push ครั้งแรกเป็น UTC `Z` | ตัวอย่างเป็น `+07:00` (`:145`) |
| `questions` | 5 / 6 / 8 ข้อ | 1–15 ข้อ (`:191`) |

**4. ผลที่ Lumos ส่งกลับ**
- คีย์ที่มีจริงแต่ docs ไม่มี: `event_id`, `client_interview_id`, `external_interview_id`, `interview_outcome_status`, `next_action` ชนิด `InterviewResult` ในโค้ดก็ไม่มี 5 คีย์นี้ (`api/_handlers/lumos-interview.ts:59-84`)
- ตาราง schema ใน docs (`:253-275`) ไม่มี `phone, language, tone, questions, scheduled_at` ทั้งที่ตัวอย่าง JSON ในเอกสารเดียวกัน (`:211-241`) มี
- `status`: docs เขียน `เสร็จสิ้น` / `ยกเลิก` (`:263`) แต่ของจริงเป็น `เสร็จสิ้น` / `ล้มเหลว` โค้ดที่เช็ค `'ยกเลิก'` (`api/_handlers/lumos-interview.ts:386`) จึงไม่เคยเจอค่านี้จริง
- คำตอบของ `POST /results`: docs เขียน `{ok, received, message}` (`:244-251`) แต่โค้ดตอบ `matched, persisted, failed` เพิ่มด้วย (`api/_handlers/lumos-interview.ts:397-407`)

**5. 🔒 คอมเมนต์ในโค้ดที่ล้าสมัย**
- `api/_lib/lumosPushClient.ts:106` เขียนว่า payload ที่ push เท่ากับที่เสิร์ฟตอนดึงคิว ซึ่งไม่จริง
- `api/_lib/lumosDispatch.ts:851` และ `api/_handlers/matching-irecruit-candidates.ts:62` เขียนว่า OT/สวัสดิการติดไปตอนเสิร์ฟ
- `api/_lib/lumosPushTracking.ts:4` เขียนว่า "delivery_count = 0 ทุกแถว" แต่จริง ๆ มี 59 แถวที่มากกว่า 0

**6. 🔒 ห้ามส่งไฟล์ Postman เดิมต่อ**
- ไฟล์นี้มี bearer token เขียนค่าตายตัวไว้ที่บรรทัด 20, 143, 285, 408 และ 550 และเขียน host production ตายตัวด้วย (บรรทัด 28)
- ไฟล์อยู่ใน git ตั้งแต่ commit `424cc61`
- ถ้าจะส่งต่อ ต้องลบ token ออกก่อน

---

## ภาคผนวก

### ก. คำถามที่ควรให้ทีม Lumos ยืนยัน

1. ถ้าเราส่ง `Idempotency-Key` และ `client_interview_id` ตัวเดิมซ้ำ หลังจากที่เรายกเลิกแล้วส่งใหม่ Lumos จะตอบผลเดิมโดยไม่สร้างสายใหม่ใช่ไหม
2. ถ้า `scheduled_at` เป็นเวลาที่ผ่านไปแล้ว (UTC `Z`) Lumos จัดการอย่างไร ช่อง interview ดูจากข้อมูลแล้วรับได้ แต่ช่อง reminder ล่ะ
3. มีสายที่ Lumos ตอบรับแล้วแต่ไม่ส่งผลกลับเกิน 24 ชม. 9 แถว (`app-`) เกิดจากอะไร
4. `status` ของผลมีค่าได้ทั้งหมดกี่แบบ และมี `ยกเลิก` จริงไหม
5. DELETE `/interviews/{client_interview_id}` และ `/reminders/{client_contact_id}` ทำงานอย่างไรกับสายที่กำลังโทรอยู่
6. ส่งได้สูงสุดกี่ record ต่อ request
7. `event_id` ในผลโทรไม่ตรงกับ `event_id` ตอนตอบรับ push (งานติดตามตรงกัน 0/265) สองค่านี้คืออะไร

### ข. 🔒 เรื่องที่ต้องแก้ฝั่งเรา (รอเจ้าของสั่ง ยังไม่ได้แก้)

- **ปุ่ม "ส่ง AI โทร (ติ๊ก N)" น่าจะพัง** (ข้อ 5)
- **ยกเลิกไม่ถึง Lumos** และผลที่มาทีหลังปลุกแถวกลับมาจนตั้งโทรซ้ำได้ (ข้อ 6.1)
- **push ไม่มีประโยครายได้และสวัสดิการ** (ข้อ 4.3)
- **push ไม่มีด่าน "หนึ่งเบอร์ หนึ่งใบขอ"** แบบที่ทางดึงคิวมี คนเดียวกันจึงอาจโดนหลายสายพร้อมกัน (`api/_lib/lumosDispatch.ts:2641-2658, 2698-2726` เทียบกับ `api/_lib/lumosPushTracking.ts:77-123`)
- **ไม่จด `event_id`** และหน้าจอไม่แสดง `push_state` / `push_error` (`api/_lib/lumosDispatch.ts:1268-1274`)
- **error ถาวร** เช่น 400 ถูกยิงซ้ำทุกนาทีจนครบ 24 ชม. (`src/lib/lumosPushRetryPolicy.ts:101-112`)
- **แถวที่ `push_state` เป็น NULL ไม่มีตัวส่งซ้ำมาตาม** (`api/_lib/lumosPushRetryWorker.ts:148-150`)
- **กดส่งแล้วสำเร็จแค่บางส่วน:** ฝั่งการ์ดถูก push ไปแล้ว แต่จอขึ้น error ถ้าฝั่ง iRecruit ตอบ 503/409 (`api/_handlers/lumos-dispatch.ts:234-282`)
- **log HTTP ระดับ `full` (ค่าเริ่มต้น)** จดชื่อและเบอร์ผู้สมัคร รวมถึง `admin_phone` ลง stdout และไม่ปิด connection id ใน path (`api/_lib/lumosHttpLog.ts:25-28`, `api/_lib/lumosPushClient.ts:211-213, 226`)