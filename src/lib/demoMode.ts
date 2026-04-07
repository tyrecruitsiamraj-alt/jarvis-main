/**
 * โหมดสาธิต: รวม mockData + demoStorage + API
 * Production (ค่าเริ่มต้น): API/DB เป็นชุดข้อมูลหลักเท่านั้น
 *
 * เปิด demo: ตั้ง VITE_DEMO_MODE=true ใน .env.local แล้วรัน dev ใหม่
 */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

