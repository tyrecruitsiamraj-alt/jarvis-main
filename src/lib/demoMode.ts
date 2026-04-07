/**
 * โหมดสาธิต: รวม mockData + demoStorage + API
 * Production (ค่าเริ่มต้น): API/DB เป็นชุดข้อมูลหลักเท่านั้น
 *
 * เปิด demo: ตั้ง VITE_DEMO_MODE=true ใน .env.local แล้วรัน dev ใหม่
 */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

/** หน้า Login แสดงปุ่มเลือกสิทธิ์ → JWT จริง (ต้องเปิด JARVIS_DEV_ROLE_LOGIN ที่ API) */
export function isDevRoleEntryEnabled(): boolean {
  return import.meta.env.VITE_DEV_ROLE_ENTRY === 'true';
}
