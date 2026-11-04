import type { JourneyStep } from './recruitJourney';

/**
 * ═══ แท็บย่อยของหน้าภาพรวมงานสรรหา (เจ้าของ 21 ต.ค. 2569 · Choice "แบ่งตามขั้น") ═══
 * ใบขอ · กรอกเข้ามา · การติดต่อ (เดิม "คนโทรต่อ" · เจ้าของเปลี่ยน 21 ต.ค.) · นัดหมาย — เลขชุดเดิมของ `RecruitOverview` แค่กระจายตามขั้น
 * เส้นทางรายชื่อ 5 ขั้น (`buildRecruitJourney`) แบ่งให้แท็บละช่วง เลขขั้นยังนับต่อจากเส้นทางเต็ม
 */
/**
 * 🔴 4 พ.ย. 2569 เจ้าของ "เอา 3 แท็บมันรวมกันเลย" — หน้าเดียว ไม่มีแท็บแล้ว (`?ov=` เลิกใช้)
 * `OverviewTabId` เหลือเป็นชื่อก้อน (การ์ดเทียบ/กดลงลึก/เส้นทาง ของแต่ละขั้น) ไม่ใช่แท็บ
 */
export type OverviewTabId = 'requests' | 'apps' | 'staff' | 'appt';

/** ขั้นของเส้นทางรายชื่อที่อยู่ในแต่ละแท็บ */
const JOURNEY_KEYS: Record<Exclude<OverviewTabId, 'requests'>, readonly string[]> = {
  apps: ['names', 'ai'],
  staff: ['staff'],
  appt: ['appointment', 'attendance'],
};

/** ขั้นของแท็บนั้น + เลขขั้นแรก (นับในเส้นทางเต็ม) */
export function journeyStepsOfTab(
  journey: readonly JourneyStep[],
  tab: Exclude<OverviewTabId, 'requests'>,
): { steps: JourneyStep[]; start: number } {
  const keys = JOURNEY_KEYS[tab];
  const first = journey.findIndex((s) => keys.includes(s.key));
  return { steps: journey.filter((s) => keys.includes(s.key)), start: first >= 0 ? first + 1 : 1 };
}
