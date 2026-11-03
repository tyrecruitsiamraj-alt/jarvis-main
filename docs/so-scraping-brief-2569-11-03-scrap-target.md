# ถึงทีม So Scraping — ขอรับจำนวนคนที่จะ Scrap จาก Jarvis (3 พ.ย. 2569)

## ที่มา
คนสั่งงานใน Jarvis ต้องบอกได้ว่าอยากได้ผู้สมัครกี่คน ตอนนี้ `createScrapeTaskFromSoRecruit` ตั้ง `target_count` จาก `erp_remaining` / `erp_qty` / 20 เอง Jarvis ส่งเลขไปไม่ได้

## ที่ Jarvis ส่งแล้ว (ขึ้นเว็บ 3 พ.ย. 2569)
ใน `job_snapshot` ของคำขอ `request_type = 'scraping'` เพิ่ม 1 ช่อง

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `scrape_target` | number (จำนวนเต็ม ≥ 1) | จำนวนคนที่คนสั่งต้องการ · ค่าเริ่มต้นบนจอ = "เหลือหา" ของใบขอ · คนสั่งแก้ได้ |

ตัวอย่าง: `{"position":"พนักงานขับรถ","location":"พระนครศรีอยุธยา","qty":1,"scrape_connector_ids":["8e1c…"],"scrape_target":25,"scrape_worker":"SONB-RM009"}`

Jarvis กันฝั่งตัวเองแล้ว: ไม่ให้สั่งเกิน `platform_cap - platform_used_today` ของบัญชีที่เลือก (อ่านจาก options)

## ที่ขอให้ So Scraping ทำ
1. `POST /api/integrations/jarvis/start` งาน scraping: อ่าน `job_snapshot.scrape_target` แล้วใช้เป็น `target_count` ของ task (แทนที่จะใช้ `erp_remaining`/`erp_qty`/20) · ไม่มีช่องนี้ = ทำแบบเดิม
2. ถ้า `scrape_target` เกินโควต้าที่เว็บนั้นเหลือวันนี้ ให้ตัดที่เพดานแล้วส่งข้อความกลับใน `message` เช่น "ขอ 25 คน วันนี้เหลือโควต้า 10 คน จะดึงให้ 10 คนก่อน" (Jarvis แสดงตรง ๆ)
3. `GET /api/integrations/jarvis/status` งาน scraping: ขอช่อง `target_count` กับ `collected` (ได้แล้วกี่คน) ใน `tasks[]` เพื่อให้หน้าใบขอบอกได้ว่า "ขอ 25 ได้แล้ว 12"

## ถามกลับ
- `platform_cap` ใน options คือโควต้าต่อวันของเว็บ (รวมทุกบัญชีของเว็บเดียวกัน) ใช่ไหม ถ้าใช่ Jarvis ใช้ `platform_cap - platform_used_today` เป็นเพดานจำนวนที่สั่งได้ ถูกต้องไหม
