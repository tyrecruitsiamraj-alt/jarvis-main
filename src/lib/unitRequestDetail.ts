/**
 * รายละเอียดเงินของใบขอ — ตรรกะล้วน แปลง `JobRequest` เป็น "ป้าย → ค่า" ที่พร้อมวาด
 *
 * 🔴 25 ส.ค. 2569 (รอบสี่สิบเอ็ด) เจ้าของสั่งย้ายที่แสดง: **หน้ารายการกลับเป็นของเดิม**
 * แถบกางในตารางถูกถอดออก · ข้อมูลชุดนี้ไปอยู่ในกล่อง "ข้อมูลใบขอ" ของหน้าใบขอแทน
 * (`SiamrajUnitRequestDetailPage` ใช้ `moneyFieldText`) — `buildUnitRequestDetail`
 * เก็บไว้เป็นนิยามกลางของกลุ่ม/ป้ายกำกับ พร้อมเทสต์ที่ล็อกกติกา "ไม่รู้ ≠ ศูนย์บาท"
 *
 * 🔴 กติกาที่ฝังไว้:
 * 1. **ไม่รู้ ≠ ศูนย์บาท** — ค่าที่เป็น `null`/`undefined` ต้องขึ้นว่า "ไม่มีข้อมูล"
 *    ห้ามแปลงเป็น 0 (เงินคนที่ออกหาเจอแค่ **76%** ของใบขอ — วัดจริง 25 ส.ค. 2569)
 *    แต่ **0 ที่มาจากฐานจริงต้องโชว์ 0** เพราะแปลว่า "ไม่ได้เบิกส่วนนี้" ไม่ใช่ไม่รู้
 * 2. **เงินสองก้อนคนละความหมาย ต้องมีป้ายกำกับเสมอ** (เจ้าของเคาะ: โชว์ทั้งคู่พร้อมป้าย)
 *    `draw` = เงินที่จ่ายพนักงาน · `fee` = ค่าที่เก็บลูกค้า
 * 3. **กลุ่มที่ไม่มีข้อมูลเลย ไม่ต้องโชว์ทั้งกลุ่ม** — ดีกว่าโชว์หัวข้อว่าง ๆ ให้คนเลื่อนผ่าน
 */

import type { JobRequest } from '@/types';

export type DetailValue =
  | { kind: 'money'; amount: number }
  /** ไม่มีข้อมูล — ต่างจากศูนย์บาท */
  | { kind: 'unknown' }
  | { kind: 'text'; text: string };

export type DetailItem = {
  key: string;
  label: string;
  value: DetailValue;
  /** คำอธิบายเล็ก ๆ ใต้ค่า (เช่น มีผลเมื่อไหร่) */
  hint?: string;
};

export type DetailGroup = {
  key: string;
  title: string;
  items: DetailItem[];
};

const money = (v: number | null | undefined): DetailValue =>
  typeof v === 'number' && Number.isFinite(v) ? { kind: 'money', amount: v } : { kind: 'unknown' };

const text = (v: string | null | undefined): DetailValue => {
  const t = String(v ?? '').trim();
  return t ? { kind: 'text', text: t } : { kind: 'unknown' };
};

/** ค่านี้มีของจริงไหม (ใช้ตัดกลุ่มที่ว่างทั้งกลุ่มทิ้ง) */
const known = (v: DetailValue): boolean => v.kind !== 'unknown';

/** จำนวนเงินเป็นข้อความไทย — ผู้เรียกใช้กับ `kind: 'money'` เท่านั้น */
export function formatMoney(amount: number): string {
  return `${amount.toLocaleString('th-TH', { maximumFractionDigits: 2 })} บาท`;
}

/**
 * จำนวนเงินสำหรับช่อง `Field` บนหน้าใบขอ — **ไม่รู้คืน `undefined`** (จอขึ้น "—")
 *
 * 🔴 แยก "ไม่รู้" ออกจาก "ศูนย์บาท" ที่นี่ที่เดียว: `null`/`undefined` = ไม่รู้ ·
 * `0` ที่มาจากฐานจริงต้องขึ้น "0 บาท" เพราะแปลว่า **ไม่ได้เบิกส่วนนั้น**
 * (ถ้าปล่อยให้จอเขียน `v || undefined` เอง ศูนย์จะกลายเป็น "—" เงียบ ๆ)
 */
export function moneyFieldText(v: number | null | undefined): string | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? formatMoney(v) : undefined;
}

/** ข้อความของค่าหนึ่งช่อง (ที่เดียว — จอไม่ต้องเขียนเงื่อนไขเอง) */
export function detailValueText(v: DetailValue): string {
  switch (v.kind) {
    case 'money':
      return formatMoney(v.amount);
    case 'text':
      return v.text;
    default:
      return 'ไม่มีข้อมูล';
  }
}

/**
 * สร้างกลุ่มรายละเอียดของใบขอหนึ่งใบ
 * กลุ่มที่ทุกช่องเป็น "ไม่มีข้อมูล" จะถูกตัดออกทั้งกลุ่ม
 */
export function buildUnitRequestDetail(job: JobRequest): DetailGroup[] {
  const groups: DetailGroup[] = [
    {
      key: 'income',
      title: 'รายได้ / ค่าจ้างของใบขอนี้',
      items: [
        {
          key: 'payment_rate',
          label: 'ค่าจ้างตามสัญญา',
          value: money(job.total_income),
          hint: 'ยอดที่ผูกกับใบขอ (payment_rate)',
        },
        { key: 'fee_name', label: 'ประเภทค่าจ้าง', value: text(job.job_description_code_2) },
        {
          key: 'penalty',
          label: 'ค่าปรับต่อวันถ้าไม่มีคน',
          value: money(job.penalty_per_day || null),
        },
      ],
    },
    {
      key: 'resigned',
      title: 'คนที่ออก — เงินล่าสุดที่เคยได้',
      items: [
        { key: 'name', label: 'ชื่อผู้ลาออก', value: text(job.resigned_employee_name) },
        {
          key: 'draw',
          label: 'เงินที่พนักงานได้ (draw)',
          value: money(job.resigned_wage_draw_rate),
          hint: 'ยอดที่จ่ายให้พนักงานคนเดิม',
        },
        {
          key: 'fee',
          label: 'ค่าที่เก็บลูกค้า (fee)',
          value: money(job.resigned_wage_fee_rate),
          hint: 'ยอดที่เรียกเก็บจากลูกค้าสำหรับตำแหน่งนี้',
        },
        {
          key: 'effective',
          label: 'มีผลตั้งแต่',
          value: text(job.resigned_wage_effective_date),
          hint: 'วันที่ของรายการล่าสุดใน ERP',
        },
      ],
    },
    {
      key: 'place',
      title: 'สถานที่ / ผู้ติดต่อ',
      items: [
        { key: 'address', label: 'สถานที่ทำงาน', value: text(job.location_address) },
        { key: 'department', label: 'แผนก', value: text(job.department_name) },
        { key: 'site_code', label: 'รหัสหน่วยงาน', value: text(job.site_code) },
      ],
    },
  ];

  // กลุ่มที่ไม่มีของจริงสักช่อง = ไม่ต้องโชว์ (ห้ามขึ้นหัวข้อว่าง)
  return groups.filter((g) => g.items.some((i) => known(i.value)));
}
