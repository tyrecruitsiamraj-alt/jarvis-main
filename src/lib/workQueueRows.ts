/**
 * ═══ คิวของหน้า "คิวงานของฉัน" — แยกสองก้อน คนละหน่วย ═══
 *
 * 🔴 **บั๊กที่ไฟล์นี้เกิดมาเพื่อแก้** (สืบสวนเลขคิว 7 ก.ย. 2569):
 * หน้า `/work` เคยเอา "กองงาน" กับ "รายคน" มาต่อกันเป็นลิสต์เดียว แล้วโชว์
 * `rows.length` ว่า *"เหลือ 6 เรื่องที่ต้องลงมือ"* — ของจริงคือ **4 กอง + 2 คน**
 * ซึ่งคนละหน่วยกันสิ้นเชิง (กองหนึ่งอาจมี 200 รายการ ส่วนคนหนึ่งคือคนหนึ่งคน)
 * ⇒ เลขนั้นบวกไม่ได้ตั้งแต่ต้น และเอาไปเทียบกับหน้าแรกก็ไม่ตรง
 *
 * 🔴 **นับซ้ำ**: ถัง `needs-human` (จาก `buildNextTasks`) กับแถวรายคนกลุ่ม
 * `needs_human` คือ **คนกลุ่มเดียวกัน** — เคยขึ้นพร้อมกันทั้งสองที่ในลิสต์เดียว
 * ที่นี่จึงตัดถังทิ้งเมื่อคนกลุ่มนั้นถูกกางเป็นรายคนแล้ว (รายคนทำงานจบได้ในหน้า
 * ส่วนถังทำได้แค่พาไปหน้าอื่น) และ **ยอดจริงของกลุ่มไม่หาย** — ไปอยู่ที่
 * `peopleTotal` / `needsHumanTotal` ซึ่งจอเอาไปขึ้นหัวก้อนรายคน
 *
 * ไฟล์นี้เป็นตรรกะล้วน (ไม่มี React) เพื่อให้เทสต์จำลองเคส needs_human > 0 ได้จริง
 */
import type { NextTask } from '@/lib/nextTask';
import type { FlowFollowUpItem } from '@/lib/flowSummaryApi';

/** กลุ่มของคนที่ตัดสินใจได้ทันที — กำหนดว่าลิ้นชักขวาจะให้ทำอะไรได้ */
export type WorkPersonGroup = 'confirmed' | 'needs_human';

/**
 * หนึ่งงานในคิว — สองชนิด **แยกก้อนกันบนจอ ห้ามเอามาบวกกัน**
 * `bucket` = กองงานทั้งถัง (เช่น เลยนัด 11 ราย) · `person` = รายคนที่ตัดสินใจได้เลย
 */
export type WorkQueueRow =
  | { kind: 'bucket'; id: string; task: NextTask }
  | { kind: 'person'; id: string; item: FlowFollowUpItem; group: WorkPersonGroup };

/** คีย์กันกดซ้ำ — คนเดียวโผล่ได้หลายใบขอ จึงต้องผูกกับใบด้วย ไม่ใช่แค่ตัวคน */
export const bookingKeyOf = (item: FlowFollowUpItem) => `${item.job_ref}::${item.person_ref}`;

/** ถังที่ซ้ำกับแถวรายคน — กางเป็นรายคนแล้วห้ามขึ้นเป็นถังซ้ำอีก */
const DUPLICATE_OF_PEOPLE: Record<WorkPersonGroup, string> = {
  needs_human: 'needs-human',
  /** กลุ่ม "สนใจงาน" ไม่มีถังคู่ใน `buildNextTasks` — เว้นไว้เป็นค่าว่างที่ไม่ตรงกับคีย์ใด */
  confirmed: '',
};

export type WorkQueueRows = {
  /** กองงาน — เลขลำดับของก้อนนี้เริ่มที่ 01 */
  buckets: WorkQueueRow[];
  /** คนที่ตัดสินใจได้เลย — เลขลำดับของก้อนนี้ **เริ่มใหม่** ที่ 01 */
  people: WorkQueueRow[];
  /** ยอดจริงของคนแต่ละกลุ่ม (ลิสต์จาก API ถูกตัดที่ 50 แถว) */
  confirmedTotal: number;
  needsHumanTotal: number;
  /** ยอดจริงรวมของก้อนรายคน — **หน่วย "คน"** ห้ามเอาไปบวกกับจำนวนกอง */
  peopleTotal: number;
  /** ลิสต์รายคนสั้นกว่ายอดจริงไหม — จอต้องบอกว่า "แสดง N จาก M รายแรก" */
  peopleTruncated: boolean;
  /** ทุกก้อนว่างหมด (ใช้แยกจาก "ยังโหลดไม่เสร็จ" ที่จอรู้เองจาก loading) */
  empty: boolean;
};

export function buildWorkQueueRows(input: {
  tasks: NextTask[];
  confirmed: readonly FlowFollowUpItem[];
  needsHuman: readonly FlowFollowUpItem[];
  /** ยอดจริงจาก `call_box_counts` — ไม่ส่งมา = ถอยไปใช้ความยาวลิสต์ */
  confirmedTotal?: number | null;
  needsHumanTotal?: number | null;
}): WorkQueueRows {
  const people: WorkQueueRow[] = [];
  for (const it of input.confirmed) {
    people.push({ kind: 'person', id: `p:c:${bookingKeyOf(it)}`, item: it, group: 'confirmed' });
  }
  for (const it of input.needsHuman) {
    people.push({ kind: 'person', id: `p:h:${bookingKeyOf(it)}`, item: it, group: 'needs_human' });
  }

  // 🔴 กันนับซ้ำ: ถังไหนถูกกางเป็นรายคนไปแล้ว ไม่ต้องขึ้นเป็นกองงานอีก
  const shownAsPeople = new Set(
    (['confirmed', 'needs_human'] as const)
      .filter((g) => people.some((r) => r.kind === 'person' && r.group === g))
      .map((g) => DUPLICATE_OF_PEOPLE[g]),
  );
  const buckets: WorkQueueRow[] = input.tasks
    .filter((t) => !shownAsPeople.has(t.key))
    .map((t) => ({ kind: 'bucket', id: `b:${t.key}`, task: t }));

  const confirmedTotal = input.confirmedTotal ?? input.confirmed.length;
  const needsHumanTotal = input.needsHumanTotal ?? input.needsHuman.length;
  const peopleTotal = confirmedTotal + needsHumanTotal;

  return {
    buckets,
    people,
    confirmedTotal,
    needsHumanTotal,
    peopleTotal,
    peopleTruncated: peopleTotal > people.length,
    empty: buckets.length === 0 && people.length === 0,
  };
}

/**
 * พาดหัวของหน้า — **ต้องอ่านออกว่าเป็นคนละหน่วย** ห้ามยุบเป็นเลขเดียว
 * (เดิมเขียนว่า "เหลือ 6 เรื่องที่ต้องลงมือ" ซึ่งเอา 4 กอง + 2 คน มาบวกกัน)
 */
export function workQueueHeadline(r: Pick<WorkQueueRows, 'buckets' | 'peopleTotal'>): string {
  const b = r.buckets.length;
  const p = r.peopleTotal;
  const th = (n: number) => n.toLocaleString('th-TH');
  if (b === 0 && p === 0) return 'วันนี้ไม่มีอะไรค้างให้ทำแล้ว';
  if (p === 0) return `มีกองงานค้างอยู่ ${th(b)} กอง`;
  if (b === 0) return `มี ${th(p)} คนรอให้คุณตัดสินใจ`;
  return `มีกองงานค้าง ${th(b)} กอง และอีก ${th(p)} คนรอให้คุณตัดสินใจ`;
}
