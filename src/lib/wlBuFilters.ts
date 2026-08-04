import type { Employee } from '@/types';
import {
  WL_BU_CODES,
  WL_BU_UNASSIGNED,
  normalizeWlBuCode,
  type WlBuCode,
  type WlBuView,
} from '@/lib/wlBuState';

/**
 * กรองพนักงานตามถังที่เลือก
 * 'unassigned' = คนที่ยังไม่มีรหัส BU (หรือมีรหัสที่ไม่ใช่ของ WL) — ต้องเห็นเพื่อจะตั้งค่าให้ได้
 */
export function filterEmployeesByBu(employees: Employee[], bu: WlBuView): Employee[] {
  if (bu === WL_BU_UNASSIGNED) {
    return employees.filter((e) => normalizeWlBuCode(e.department_code) === null);
  }
  return employees.filter((e) => normalizeWlBuCode(e.department_code) === bu);
}

export function countEmployeesByBu(
  employees: Employee[],
): Record<WlBuView, number> {
  const counts = {
    ...(Object.fromEntries(WL_BU_CODES.map((c) => [c, 0])) as Record<WlBuCode, number>),
    [WL_BU_UNASSIGNED]: 0,
  } as Record<WlBuView, number>;
  for (const e of employees) {
    const bu = normalizeWlBuCode(e.department_code);
    counts[bu ?? WL_BU_UNASSIGNED] += 1;
  }
  return counts;
}

export function employeeIdsForBu(employees: Employee[], bu: WlBuView): Set<string> {
  return new Set(filterEmployeesByBu(employees, bu).map((e) => e.id));
}
