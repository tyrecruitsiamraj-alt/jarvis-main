import type { Employee } from '@/types';
import {
  WL_BU_CODES,
  normalizeWlBuCode,
  type WlBuCode,
} from '@/lib/wlBuState';

export function filterEmployeesByBu(employees: Employee[], bu: WlBuCode): Employee[] {
  return employees.filter((e) => normalizeWlBuCode(e.department_code) === bu);
}

export function countEmployeesByBu(
  employees: Employee[],
): Record<WlBuCode, number> {
  const counts = Object.fromEntries(WL_BU_CODES.map((c) => [c, 0])) as Record<WlBuCode, number>;
  for (const e of employees) {
    const bu = normalizeWlBuCode(e.department_code);
    if (bu) counts[bu] += 1;
  }
  return counts;
}

export function employeeIdsForBu(employees: Employee[], bu: WlBuCode): Set<string> {
  return new Set(filterEmployeesByBu(employees, bu).map((e) => e.id));
}
