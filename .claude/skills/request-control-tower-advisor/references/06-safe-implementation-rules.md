# กติกาการลงมืออย่างปลอดภัย

## ห้ามเขียนทับแดชบอร์ดเดิมตรง ๆ

ใช้สถาปัตยกรรมแบบปลอดภัย 8 ขั้น:

1. ชั้นคำนวณคู่ขนาน (parallel calculation layer)
2. feature flag
3. adapter
4. API แบบอ่านอย่างเดียว
5. ชนิดข้อมูลที่เข้ากันได้กับของเดิม
6. เส้นทางพรีวิว
7. unit test
8. การกระทบยอด (reconciliation)

## โครงโฟลเดอร์ที่แนะนำ

`src/lib/dashboard/request-control/`

* `types.ts` — ชนิดข้อมูล
* `adapters.ts` — ตัวแปลงข้อมูล
* `requestLedger.ts` — บัญชีใบขอ
* `fulfillmentLedger.ts` — บัญชีเหตุการณ์การหาได้
* `calculations.ts` — การคำนวณ
* `sla.ts` — กติกา SLA
* `lifecycle.ts` — วงจรชีวิตใบขอ
* `reconciliation.ts` — การกระทบยอด
* `mock.ts` — ข้อมูลจำลอง
* `index.ts`

## ห้ามลบหรือเปลี่ยนชื่อฟิลด์เดิมของ DashboardData

ถ้าจำเป็นต้องเพิ่ม ให้ต่อยอดแบบปลอดภัย:

```ts
type EnhancedDashboardData = DashboardData & {
  requestControl?: RequestControlDashboardData;
};
```

## Feature flag

`VITE_REQUEST_CONTROL_TOWER_ENABLED=true`

* **เปิด** → แสดงหน้า Request Control Tower
* **ปิด** → แสดง Analytics Dashboard เดิมทุกอย่างเหมือนเดิมเป๊ะ

## กติกาคุณภาพข้อมูล

ยอด **"หาได้แล้ว" รายเดือน** ควรใช้วันที่ของเหตุการณ์การหาได้ (fulfillment event date)
เมื่อมีข้อมูล

ถ้ามีแต่ snapshot `inform_qty` ล่าสุด **ต้องติดธง `snapshot_fallback`** แล้วแสดงข้อความว่า
"ประมาณการจากสถานะล่าสุด"

> ⚠️ ห้ามเอา snapshot `inform_qty` มาใช้เป็นยอดรายเดือนที่แม่นยำโดยไม่ติดธง
