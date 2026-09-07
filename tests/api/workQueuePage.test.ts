// @vitest-environment node
/**
 * ═══ ด่านของหน้า "คิวงานของฉัน" (หน้าเดียวจบงาน) ═══
 *
 * หน้านี้เป็นการ **ออกแบบใหม่จริง** รอบแรก (5 ก.ย. 2569) หลังเจ้าของตีกลับว่า
 * *"ไม่ได้มีอะไรใหม่เลย ก็ที่ฉันเคยทำไว้ทั้งนั้น"* ⇒ ต้องคุมสามเรื่องให้แน่น:
 * ปลอดภัยกับ production · ตัวเลขตรงกับหน้าแรก · ไม่เพิ่มภาระให้ ERP
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { buildNextTasks } from '@/lib/nextTask';
import { buildWorkQueueRows, workQueueHeadline } from '@/lib/workQueueRows';
import type { FlowFollowUpItem } from '@/lib/flowSummaryApi';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const page = read('src/pages/work/WorkQueuePage.tsx');
const home = read('src/pages/HomePage.tsx');

/** คนหนึ่งคนในลิสต์ผลโทร — เท่าที่คิวงานใช้จริง */
const person = (n: number): FlowFollowUpItem => ({
  job_ref: `siamraj-sql:OPL${n}`,
  request_no: `OPL${n}`,
  person_ref: `card-${n}`,
  channel: 'interview',
  name: `คนที่ ${n}`,
  phone: '0800000000',
  summary: null,
  outcome: 'confirmed',
  updated_at: '2026-09-07T03:00:00.000Z',
  job_position: null,
  job_unit: null,
});

describe('ปลอดภัยกับ production', () => {
  it('🔴 ไม่ได้เปิดสวิตช์ = เด้งกลับหน้าแรก (พนักงานทั่วไปไม่มีทางหลงเข้ามา)', () => {
    expect(page).toContain('useUiV2');
    expect(page).toMatch(/if \(!uiV2\) return <Navigate to="\/" replace \/>;/);
  });

  it('เมนูโชว์รายการนี้เฉพาะคนที่เปิดสวิตช์', () => {
    const drawer = read('src/components/layout/AppNavDrawer.tsx');
    expect(drawer).toMatch(/uiV2 \? \([\s\S]{0,400}\/work/);
  });

  it('ของเดิมไม่ถูกแตะ — หน้าแรกยังมีทั้งสองโฉมครบ', () => {
    expect(home).toContain('<CommandDeck');
    expect(home).toContain('<HomeDeckV2');
  });
});

/**
 * ═══ ทางเข้าหน้านี้ต้อง "หาเจอ" แต่ต้องโผล่เฉพาะโฉมใหม่ ═══
 * ที่มา: `docs/audit-v1-v2-functions-2569-09-07.md` §5 งง-6 + §6 ข้อเสนอที่ 7 —
 * หน้า `/work` เข้าได้ทางเมนู burger ทางเดียว คนที่ไม่เปิดเมนูไม่มีวันรู้ว่ามีหน้านี้
 */
describe('ทางเข้าหน้า /work ต้องมีสองจุด และเห็นเฉพาะ v2', () => {
  const deckV2 = read('src/components/home/HomeDeckV2.tsx');
  const deckV1 = read('src/components/home/CommandDeck.tsx');
  const drawer = read('src/components/layout/AppNavDrawer.tsx');

  it('จุดที่ 1 · เมนู burger มีรายการ "คิวงานของฉัน"', () => {
    expect(drawer).toContain('คิวงานของฉัน');
    expect(drawer).toMatch(/go\('\/work'\)/);
  });

  it('จุดที่ 2 · หน้าแรกโฉมใหม่มีลิงก์ไป /work พร้อมประโยคอธิบายว่ามันคืออะไร', () => {
    expect(deckV2).toMatch(/to="\/work"/);
    expect(deckV2).toContain('คิวงานของฉัน');
    // งง-6: ไม่ใช่แค่ลิงก์เปล่า ต้องบอกด้วยว่าต่างจากคิวบนหน้าแรกยังไง
    expect(deckV2).toMatch(/คิวชุดเดียวกับข้างบน[\s\S]{0,80}หน้าเดียว/);
  });

  it('🔴 ทางเข้าบนหน้าแรกอยู่หลังสวิตช์ — v1 ไม่เห็นอะไรเปลี่ยนเลย', () => {
    // `HomeDeckV2` ถูกเรนเดอร์เฉพาะกิ่ง uiV2 เท่านั้น (ธงอยู่ที่หน้า ไม่ใช่ในแผง)
    expect(home).toMatch(/uiV2 \? \(\s*<HomeDeckV2/);
    // ของเดิมต้องไม่มีทางเข้า — v1 เข้า /work ไปก็โดนเด้งกลับหน้าแรก
    expect(deckV1).not.toContain('/work');
  });

  it('🔴 ปุ่มเบอร์กันดีของหน้าแรกยังมีใบเดียว — ทางเข้า /work เป็นปุ่มรอง', () => {
    // ปุ่ม default (เบอร์กันดี) = ปุ่ม "ไปทำงาน" ของงานถัดไปเท่านั้น
    expect(deckV2).not.toMatch(/variant="default"/);
    expect(deckV2).toMatch(/<Button asChild variant="outlineStrong"/);
    expect((deckV2.match(/<Button asChild(?! variant)/g) ?? []).length).toBe(1);
  });
});

describe('ตัวเลขต้องตรงกับหน้าแรก (ห้ามคิดเอง)', () => {
  /** ดึงพารามิเตอร์ที่ป้อนให้ buildNextTasks ออกมาเทียบกันสองไฟล์ */
  const inputsOf = (src: string): string[] => {
    const m = src.match(/buildNextTasks\(\{([\s\S]*?)\}\)/);
    if (!m) return [];
    return m[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//'))
      .map((l) => l.replace(/\s+/g, ''));
  };

  it('🔴 ป้อนค่าชุดเดียวกับหน้าแรกทุกช่อง', () => {
    const a = inputsOf(home);
    const b = inputsOf(page);
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });

  it('ใช้ตรรกะกลาง `buildNextTasks` ไม่เขียนเงื่อนไขคิวเอง', () => {
    expect(page).toContain("from '@/lib/nextTask'");
  });
});

/**
 * ═══ 🔴 คิวสองก้อน คนละหน่วย — ห้ามนับซ้ำ ห้ามบวกข้ามหน่วย ═══
 * ที่มา: สืบสวนเลขคิว 7 ก.ย. 2569 · หน้านี้เคยต่อ "กองงาน" กับ "รายคน" เป็นลิสต์เดียว
 * แล้วโชว์ `rows.length` ว่า "เหลือ 6 เรื่อง" (ของจริง = 4 กอง + 2 คน)
 * และคนกลุ่ม needs_human ยังโผล่ซ้ำสองที่ (เป็นถัง + เป็นรายคน) ในลิสต์เดียวกัน
 */
describe('คิวแยกสองก้อน · กันนับซ้ำ', () => {
  const tasks = buildNextTasks({ followPastDue: 3, needsHuman: 2, slaBreached: 10 });

  it('🔴 needs_human กางเป็นรายคนแล้ว ถังใบเดิมต้องไม่ขึ้นซ้ำ', () => {
    expect(tasks.map((t) => t.key)).toContain('needs-human');
    const q = buildWorkQueueRows({
      tasks,
      confirmed: [],
      needsHuman: [person(1), person(2)],
      needsHumanTotal: 2,
    });
    expect(q.buckets.map((r) => (r.kind === 'bucket' ? r.task.key : ''))).not.toContain(
      'needs-human',
    );
    expect(q.people).toHaveLength(2);
    // คนสองคนนี้ต้องถูกนับ "ครั้งเดียว" ในระบบทั้งหน้า
    expect(q.peopleTotal).toBe(2);
    expect(q.buckets).toHaveLength(2); // เหลือ follow-past-due + sla-breached
  });

  it('ไม่มีรายชื่อ needs_human มาให้ (เช่นโหลดไม่ได้) ⇒ ถังยังอยู่ ไม่ทำข้อมูลหาย', () => {
    const q = buildWorkQueueRows({ tasks, confirmed: [], needsHuman: [] });
    expect(q.buckets.map((r) => (r.kind === 'bucket' ? r.task.key : ''))).toContain('needs-human');
  });

  it('🔴 ยอดคนใช้ตัวนับจริง ไม่ใช่ความยาวลิสต์ที่ SQL ตัดที่ 50', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => person(i));
    const q = buildWorkQueueRows({
      tasks: [],
      confirmed: fifty,
      needsHuman: [],
      confirmedTotal: 137,
    });
    expect(q.confirmedTotal).toBe(137);
    expect(q.peopleTotal).toBe(137);
    expect(q.peopleTruncated).toBe(true);
    expect(q.people).toHaveLength(50);
  });

  it('ไม่มีตัวนับมาจาก API รุ่นเก่า ⇒ ถอยไปใช้ความยาวลิสต์ (ไม่พัง)', () => {
    const q = buildWorkQueueRows({ tasks: [], confirmed: [person(1)], needsHuman: [person(2)] });
    expect(q.peopleTotal).toBe(2);
    expect(q.peopleTruncated).toBe(false);
  });

  it('พาดหัวบอกสองหน่วยแยกกัน — ห้ามยุบเป็นเลขเดียว', () => {
    const q = buildWorkQueueRows({
      tasks,
      confirmed: [person(1)],
      needsHuman: [person(2)],
      confirmedTotal: 1,
      needsHumanTotal: 1,
    });
    const line = workQueueHeadline(q);
    expect(line).toContain('กอง');
    expect(line).toContain('คน');
    // 2 กอง + 2 คน — ห้ามมีคำว่า "4 เรื่อง" โผล่มาจากไหน
    expect(line).not.toMatch(/4/);
    expect(workQueueHeadline({ buckets: [], peopleTotal: 0 })).toBe('วันนี้ไม่มีอะไรค้างให้ทำแล้ว');
  });

  it('จอต้องเรียกตรรกะกลาง ไม่ปั้นลิสต์รวมเอง', () => {
    expect(page).toContain('buildWorkQueueRows');
    expect(page).toContain('workQueueHeadline');
    expect(page).not.toMatch(/\[\.\.\.buckets, \.\.\.people\]/);
  });
});

describe('ห้ามเพิ่มภาระให้ระบบงานหลัก', () => {
  it('🔴 ใช้เฉพาะสองเส้นที่หน้าแรกโหลดอยู่แล้ว — ไม่มี apiFetch ตรง ๆ', () => {
    expect(page).toContain('fetchFlowSummary');
    expect(page).toContain('fetchOfficeFloor');
    expect(page).not.toContain('apiFetch(');
  });

  it('ปุ่มจองตัวใช้เส้นเดิม (กติกา 1 คนจองได้ใบเดียวติดมาเอง)', () => {
    expect(page).toContain('saveProposal');
    expect(page).toContain('bookingActionFor');
    // ปิดปุ่มเมื่อไหร่ต้องบอกเหตุผลเสมอ
    expect(page).toMatch(/action\.disabled \? action\.reason/);
  });
});

describe('สีพื้น hover ต้องไม่ใช่สีแบรนด์', () => {
  it('🔴 branding เลิกทับ --accent แล้ว (ไม่งั้นแถวที่เลือกเป็นบล็อกสีทั้งก้อน)', () => {
    const b = read('src/lib/brandingStorage.ts');
    expect(b).toMatch(/removeProperty\('--accent'\)/);
    expect(b).not.toMatch(/setProperty\('--accent', c\.primaryHsl\)/);
  });
});
