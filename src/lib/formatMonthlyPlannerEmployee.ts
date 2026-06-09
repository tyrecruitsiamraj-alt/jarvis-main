import { inferDistrictFromAddress, inferProvinceFromAddress } from '@/lib/parseThaiJobAddress';

export type MonthlyPlannerEmployeeFields = {
  first_name: string;
  last_name: string;
  phone: string;
  address?: string;
  title_prefix?: string;
  base_salary?: number;
};

function residenceLabel(address: string | undefined): string | null {
  const district = address ? inferDistrictFromAddress(address) : null;
  if (!district) return null;
  const province = address ? inferProvinceFromAddress(address) : null;
  const isBangkok = province === 'กรุงเทพมหานคร';
  return `พัก ${isBangkok ? 'เขต' : 'อำเภอ'}${district}`;
}

/** บรรทัดชื่อในตาราง Monthly Planner เช่น นายสมบูรณ์ เทียมปาน เบอร์โทร 061-914-9292 พัก อำเภอเมือง ฐานเงินเดือน 11,160 */
export function formatMonthlyPlannerEmployeeLine(emp: MonthlyPlannerEmployeeFields): string {
  const name = [emp.title_prefix?.trim(), emp.first_name.trim(), emp.last_name.trim()]
    .filter(Boolean)
    .join(' ');
  const phone = emp.phone.trim();
  const residence = residenceLabel(emp.address);
  const salary =
    emp.base_salary != null && emp.base_salary > 0
      ? `ฐานเงินเดือน ${emp.base_salary.toLocaleString('th-TH')}`
      : null;

  return [name, phone ? `เบอร์โทร ${phone}` : '', residence, salary].filter(Boolean).join(' ');
}
