import type { JourneyStep } from './recruitJourney';

/**
 * ═══ แท็บย่อยของหน้าภาพรวมงานสรรหา (เจ้าของ 21 ต.ค. 2569 · Choice "แบ่งตามขั้น") ═══
 * ใบขอ · กรอกเข้ามา · การติดต่อ (เดิม "คนโทรต่อ" · เจ้าของเปลี่ยน 21 ต.ค.) · นัดหมาย — เลขชุดเดิมของ `RecruitOverview` แค่กระจายตามขั้น
 * เส้นทางรายชื่อ 5 ขั้น (`buildRecruitJourney`) แบ่งให้แท็บละช่วง เลขขั้นยังนับต่อจากเส้นทางเต็ม
 */
export const OVERVIEW_TABS = [
  { id: 'requests', label: 'ใบขอ' },
  { id: 'apps', label: 'กรอกเข้ามา' },
  { id: 'staff', label: 'การติดต่อ' },
  { id: 'appt', label: 'นัดหมาย' },
] as const;

export type OverviewTabId = (typeof OVERVIEW_TABS)[number]['id'];

/** ค่าใน `?ov=` → แท็บ · ไม่รู้จัก = ใบขอ */
export function overviewTabOf(raw: string | null | undefined): OverviewTabId {
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
