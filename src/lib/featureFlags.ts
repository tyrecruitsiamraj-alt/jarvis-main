/**
 * สวิตช์แม่ระดับฟีเจอร์ — นิยามกลางที่ทั้งหน้าเว็บและ API ใช้ร่วมกัน
 *
 * คนละชั้นกับ roleFunctions (สิทธิ์):
 *   ชั้นนี้     = ฟีเจอร์นี้เปิดใช้งานในระบบหรือยัง
 *   ชั้นสิทธิ์  = เปิดแล้วใครใช้ได้บ้าง
 *
 * ปิดชั้นนี้ = ไม่มีใครเห็น ยกเว้น admin (ต้องทดสอบบนของจริงได้)
 */

export const FEATURES = [
  {
    id: 'recruit_postings',
    label: 'ประกาศรับสมัคร / สร้างลิงก์',
    description: 'สร้างประกาศ + ลิงก์ต่อช่องทางจากกล่องงาน · กล่องลอย 5 ประเภท · จัดการช่องทาง',
  },
] as const;

export type FeatureId = (typeof FEATURES)[number]['id'];

const FEATURE_IDS = new Set<string>(FEATURES.map((f) => f.id));

export function isFeatureId(value: unknown): value is FeatureId {
  return typeof value === 'string' && FEATURE_IDS.has(value);
}

export function featureLabel(id: string): string {
  return FEATURES.find((f) => f.id === id)?.label ?? id;
}

export type FeatureFlag = {
  featureId: string;
  enabled: boolean;
  note: string | null;
  updatedAt: string | null;
};

/** map พร้อมใช้ — ฟีเจอร์ที่ไม่มีแถวในตารางถือว่าเปิด */
export type FeatureFlagMap = Record<string, boolean>;

export function buildFeatureFlagMap(flags: FeatureFlag[]): FeatureFlagMap {
  const map: FeatureFlagMap = {};
  for (const f of FEATURES) map[f.id] = true;
  for (const f of flags) map[f.featureId] = f.enabled;
  return map;
}

/**
 * ฟีเจอร์นี้ใช้ได้ไหมสำหรับ role นี้
 * ปิดอยู่ → admin ยังเห็น (ไปทดสอบได้) คนอื่นไม่เห็นเลย
 */
export function isFeatureVisible(
  featureId: FeatureId,
  flags: FeatureFlagMap | null | undefined,
  role: string | null | undefined,
): boolean {
  const enabled = flags?.[featureId] ?? true;
  if (enabled) return true;
  return role === 'admin';
}
