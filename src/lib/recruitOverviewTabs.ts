import type { JourneyStep } from './recruitJourney';

/**
 * ═══ แท็บย่อยของหน้าภาพรวมงานสรรหา (เจ้าของ 21 ต.ค. 2569 · Choice "แบ่งตามขั้น") ═══
 * ใบขอ · กรอกเข้ามา · การติดต่อ (เดิม "คนโทรต่อ" · เจ้าของเปลี่ยน 21 ต.ค.) · นัดหมาย — เลขชุดเดิมของ `RecruitOverview` แค่กระจายตามขั้น
 * เส้นทางรายชื่อ 5 ขั้น (`buildRecruitJourney`) แบ่งให้แท็บละช่วง เลขขั้นยังนับต่อจากเส้นทางเต็ม
 */
/**
 * 🔴 29 ต.ค. 2569 เจ้าของ "หน้า กรอกเข้ามา … เอาออกเลย ไปรวมกับ แท็บใบขอ" — แท็บเหลือ 3 · ของแท็บกรอกเข้ามาอยู่ท้ายแท็บใบขอ
 * `OverviewTabId` ยังมี 'apps' เป็นชื่อก้อน (การ์ดเทียบ/กดลงลึก/เส้นทาง ของคนที่กรอก) ไม่ใช่แท็บ
 */
export const OVERVIEW_TABS = [
  // ชื่อแท็บ "ภาพรวม Online" (เจ้าของ 29 ต.ค. 2569 "คำว่า ใบขอ … เปลี่ยนเป็น ภาพรวม Online ก้ได้") · id เดิม `requests` (`?ov=` ลิงก์เก่ายังเปิดได้)
  { id: 'requests', label: 'ภาพรวม Online' },
  { id: 'staff', label: 'การติดต่อ' },
  { id: 'appt', label: 'นัดหมาย' },
] as const;

export type OverviewTabId = 'requests' | 'apps' | 'staff' | 'appt';
export type OverviewVisibleTabId = (typeof OVERVIEW_TABS)[number]['id'];

/** ค่าใน `?ov=` → แท็บ · ไม่รู้จัก (รวมลิงก์เก่า `?ov=apps`) = ใบขอ */
export function overviewTabOf(raw: string | null | undefined): OverviewVisibleTabId {
  return OVERVIEW_TABS.find((t) => t.id === raw)?.id ?? 'requests';
}

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
