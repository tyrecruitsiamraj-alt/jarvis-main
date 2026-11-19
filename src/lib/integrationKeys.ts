/**
 * ระบบภายนอกที่ออก key ได้ (หน้า ตั้งค่า › เชื่อมระบบภายนอก · 22 ต.ค. 2569)
 * ชื่อ = แถวใน `app_integration_keys` · เส้นที่ใช้ key ระบุไว้ให้ก๊อปไปตั้งค่าที่ระบบนั้น
 */
export const INTEGRATIONS = [
  {
    name: 'so-scraping',
    label: 'So Scraping',
    endpoints: ['/api/integrations/so-scraping/leads', '/api/integrations/so-scraping/ai-call'],
  },
  // iRecruit ดึงผลแบบทดสอบ (เจ้าของ 18 พ.ย. 2569) — ไฟล์ api/_handlers/irecruit-integration.ts
  {
    name: 'irecruit',
    label: 'iRecruit',
    endpoints: ['/api/integrations/irecruit/skill-results'],
  },
] as const;

export type IntegrationName = (typeof INTEGRATIONS)[number]['name'];

export function isIntegrationName(v: unknown): v is IntegrationName {
  return typeof v === 'string' && INTEGRATIONS.some((i) => i.name === v);
}
