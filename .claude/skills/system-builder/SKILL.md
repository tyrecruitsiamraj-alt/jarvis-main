---
name: system-builder
description: โคลนวิธีทำงานของคนทำระบบ jarvis ใช้เมื่อจะแก้โค้ด เพิ่มฟีเจอร์ แก้บั๊ก แตะฐานข้อมูล เพิ่ม API เปลี่ยนสี ทำ migration หรือถามว่าแก้ตรงไหน ไฟล์ไหน ระวังอะไร ทดสอบยังไง — jarvis system builder conventions, safe change workflow, gotchas
---

# คนทำระบบ jarvis

โคลนวิธีทำงานที่พิสูจน์แล้วในโปรเจกต์นี้ — **ไม่ใช่วิธีเขียนโค้ดทั่วไป
แต่เป็นวิธีที่ไม่พังกับระบบนี้โดยเฉพาะ**

## กฎเหล็ก 5 ข้อ (ผิดข้อไหนเจ็บทุกที)

### 1. ฐานข้อมูลบนเครื่อง = ของจริงบน production
`.env.local` ชี้ DB จริง · ทดสอบอะไรที่เขียนข้อมูล **ต้องคืนค่าเดิมเสมอ**
ทดสอบผลโทรปลอมใส่คิวจริง = ไปขยับสถานะสายของผู้สมัครจริง — อย่าทำ

### 2. เช็ก TypeScript สอง config เสมอ
```bash
npx tsc --noEmit -p tsconfig.app.json   # ครอบ src/ — ตัวนี้สำคัญกว่า
npx tsc --noEmit                        # ไม่ครอบ src/
```
เคยลืม import แล้วตัวแรกผ่านเงียบ ๆ เพราะรันแต่ตัวที่สอง

### 3. ห้ามแก้ class หลายจุดด้วย regex
เคยพัง 2 ครั้งในวันเดียว — แทรก `${TONE...}` ลงใน string ธรรมดา (กลายเป็นข้อความดิบ)
และแทรกคอมเมนต์ JSX ผิดตำแหน่ง (JSX พังทั้งไฟล์)
**แก้มือทีละจุด** หรือถ้าจำเป็นให้สคริปต์ทำแบบ "เติมท้ายอย่างเดียว" ห้ามแทนที่

### 4. ความหมายสีมาจาก `src/lib/designTokens.ts` ที่เดียว
ห้ามเขียน class สี Tailwind สดในไฟล์หน้า · ทุกสีธีมสว่างต้องมีคู่ `dark:`
มีเทสต์บังคับที่ `tests/api/designTokens.test.ts`

**กับดักที่เจอบ่อยสุด:** ใส่ `dark:border` `dark:text` ครบ แต่**ลืม `dark:bg`**
→ โหมดมืดกล่องยังสว่าง ตัวหนังสือกลายเป็นสีจาง จมหายไปกับพื้นตัวเอง
หาเจอด้วย: grep หา `bg-white` / `bg-<สี>-50` ในบรรทัดที่ไม่มี `dark:bg-`

### 5. ตรวจงานเองในเบราว์เซอร์เสมอ
ห้ามให้เจ้าของไปกดเอง · dev server ใช้ `preview_start` (vite 8080 · api 3100)
ห้ามรันด้วย Bash · auth ทดสอบ: `POST /api/auth/dev-role {"role":"admin"}` (cookie ~30 นาที)
สลับธีมตอนทดสอบ: `localStorage['jarvis:theme'] = 'dark'|'light'` แล้ว reload
(เปลี่ยน class บน `<html>` เฉย ๆ ไม่พอ — theme.ts เขียนทับตอน mount)

## ก่อนแตะโค้ด ต้องอ่านอะไร

1. `docs/SESSION-HANDOFF.md` — สถานะล่าสุด + สิ่งที่รอเจ้าของตัดสิน
2. `.claude/skills/request-control-tower-advisor/references/09-editing-map.md`
   — **แผนที่ไฟล์ + กับดักทุกข้อ อ่านทุกครั้ง**
3. `docs/PLAN-NEXT.md` — งานที่ค้างอยู่

## ที่ไหนแก้อะไร (ทางลัด)

| อยากแก้ | ไปที่ |
|---|---|
| ฟิลด์ที่ดึงจาก ERP | `api/_lib/siamrajSqlServerRequests.ts` — **แก้ 3 จุดในไฟล์: row type + BASE_SQL + SELECT_COLUMNS** ลืมตัวท้ายค่าหายเงียบ |
| ความหมายสี | `src/lib/designTokens.ts` |
| ลำดับความสำคัญผู้สมัคร | `src/lib/candidatePriority.ts` |
| นโยบายหลังได้ผลโทร | `src/lib/callFollowupPolicy.ts` (pure + เทสต์ 25 เคส) |
| ฐานตัวเลข funnel | `src/lib/callFunnelMath.ts` (มีเทสต์กันถอย) |
| โหมดส่งงานให้ AI | `src/lib/lumosDispatchMode.ts` |
| แจ้งเตือน | `api/_lib/appNotifications.ts` |
| เพิ่ม API เส้นใหม่ | เขียน handler + **ลงทะเบียนใน `api/_handlers/registry.ts`** + `npx tsx scripts/verify-api-registry.mjs` |

## กติกาความปลอดภัยของระบบนี้

* **ล็อกโทรผูกกับเบอร์ E.164 ไม่ใช่ `candidate_ref`** — คนเดียวมีหลายรหัส แต่เบอร์มีเบอร์เดียว
* **DB ตัดสินว่าใครชนะ ไม่ใช่ลำดับโค้ด** — ใช้ partial unique index + อ่าน unique violation
  ห้ามเปลี่ยนเป็นเช็คก่อนแล้วค่อย insert (race ได้)
* **`insertQueueItems()` เป็นคอขวดเดียวของการเข้าคิวทุกเส้น** — กรองที่นั่นที่เดียวครอบทุกทาง
* **fail-safe ไปทางไม่ส่ง/manual เสมอ** — เผลอโทรหาคนที่บอกว่าเลิกหางานแล้ว กู้คืนไม่ได้
* **ห้ามโทร 20:00–08:00** — `shiftOutOfQuietHours()`
* **`new Intl.*` ประกาศระดับโมดูลเสมอ** — เคยทำ API ช้า 4.7 วินาที มีเทสต์คุมความเร็ว
* **แจ้งเตือนต้องกลืน error เสมอ** — ห้ามให้มันทำงานหลักล้ม

## จังหวะทำงานที่เจ้าของชอบ

* สั่งเป็น bullet ไทยหลายข้อ → **ทำครบทุกข้อแล้วสรุปทีเดียว** ไม่ใช่รายงานทีละข้อ
* **ห้าม push จนกว่าจะสั่ง** — ยกเว้นสั่งไว้ว่า "commit & push ทีละข้อ"
* commit แยกก้อนตามเรื่อง · message ไทย บอก**เหตุผล**และ**สิ่งที่ตรวจจริง**
* เอาฟีเจอร์ออก = เอาออกให้สุด (UI + state + URL param) ไม่ใช่แค่ซ่อน
* เจ้าของบอก "ทำแบบเดิม" → เช็ก git history ก่อนว่าเคยมีจริงไหม
* รายงานตรง ๆ — อะไรตรวจแล้ว อะไรยังไม่ได้ตรวจ ต้องบอก อย่ากลบ

## ก่อน commit ทุกครั้ง

```bash
npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit
npm run test        # baseline ปัจจุบัน 567 ผ่าน / 4 skipped
npx eslint .        # 0 error · 16 warning เดิม
```
เทสต์ตกจาก baseline หรือ tsc มี error = **ของใหม่พัง ไม่ใช่ของเดิม**
