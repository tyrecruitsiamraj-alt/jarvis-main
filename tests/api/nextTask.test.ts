import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { CONVEYOR_STEPS } from '@/lib/soRecruitNav';
import { buildNextTasks, pickNextTask } from '@/lib/nextTask';

describe('buildNextTasks — คิวงานหน้าแรก', () => {
  it('ยังไม่รู้ค่า (null / ไม่มีคีย์) = ไม่มีบรรทัด ห้ามเดาเป็น 0', () => {
    expect(buildNextTasks({})).toEqual([]);
    expect(buildNextTasks({ followPastDue: null, applicantsUntouched: null })).toEqual([]);
  });

  it('รู้ว่าเป็น 0 = ไม่มีงานให้ทำ ⇒ ก็ไม่มีบรรทัดเหมือนกัน', () => {
    expect(buildNextTasks({ followPastDue: 0, applicantsUntouched: 0 })).toEqual([]);
  });

  it('เรียงตามความเสียหาย ไม่ใช่ตามจำนวน — คนที่รอสายอยู่มาก่อนยอดสะสม', () => {
    const tasks = buildNextTasks({ slaBreached: 202, followPastDue: 1 });
    expect(tasks.map((t) => t.key)).toEqual(['follow-past-due', 'sla-breached']);
    expect(pickNextTask(tasks)?.count).toBe(1);
  });

  it('หัวข้อมีตัวเลขจริงอยู่ในประโยค — คนอ่านแล้วรู้ปริมาณโดยไม่ต้องดูป้าย', () => {
    const [t] = buildNextTasks({ applicantsUntouched: 7 });
    expect(t.title).toContain('7');
    expect(t.reason).toBeTruthy();
    expect(t.badge).toBeTruthy();
    expect(t.path).toBe('/jobs/board?view=list');
    expect(t.stepKey).toBe('matching');
  });

  it('ทุกใบมีทางไปต่อ และคีย์ลำดับงานมีอยู่จริง', () => {
    const tasks = buildNextTasks({
      followPastDue: 1,
      needsHuman: 2,
      claimedIdle: 3,
      applicantsUntouched: 4,
      callsStale: 5,
      slaBreached: 6,
    });
    expect(tasks).toHaveLength(6);
    for (const t of tasks) {
      expect(t.path.startsWith('/'), t.key).toBe(true);
      expect(t.action, t.key).toBeTruthy();
      /** 🔴 ผูกกับลำดับงานด้วย **คีย์** ไม่ใช่เลขขั้น (เลิกใช้เลข 28 ส.ค. 2569) */
      expect(
        CONVEYOR_STEPS.some((s) => s.key === t.stepKey),
        `${t.key} -> ${t.stepKey}`,
      ).toBe(true);
    }
    expect(new Set(tasks.map((t) => t.key)).size).toBe(6);
  });

  /**
   * 🗑️ ถังตายถูกลบทิ้ง 7 ก.ย. 2569 — `follow-not-dispatched` อยู่ในลิสต์มาตลอดแต่
   * **ไม่มีหน้าไหนป้อนค่าให้เลย** ⇒ อ่านโค้ดแล้วเข้าใจผิดว่าระบบเฝ้าอยู่ (เหตุผลเต็มใน nextTask.ts)
   * ด่านนี้กันไม่ให้ถังตายใบใหม่งอกขึ้นมาอีก: ทุก `field` ต้องมีคนป้อนค่าจริงบนจอ
   */
  it('ทุกช่องรับค่าของ nextTask มีหน้าจอป้อนค่าให้จริง — ไม่มีถังตายค้างไว้', () => {
    const root = path.resolve(__dirname, '../..');
    const src = fs.readFileSync(path.join(root, 'src/lib/nextTask.ts'), 'utf8');
    const screens = ['src/pages/HomePage.tsx', 'src/pages/work/WorkQueuePage.tsx'].map((p) =>
      fs.readFileSync(path.join(root, p), 'utf8'),
    );
    const fields = [...src.matchAll(/field: '([^']+)'/g)].map((m) => m[1]);
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      for (const s of screens) {
        expect(s, `ไม่มีหน้าไหนป้อน ${f} — ถังนี้ไม่มีทางขึ้นจอ`).toContain(`${f}:`);
      }
    }
  });

  it('ถังสีแดงต้องมาก่อนสีเหลือง และเหลืองมาก่อนฟ้าเสมอ', () => {
    const tasks = buildNextTasks({
      slaBreached: 99,
      applicantsUntouched: 99,
      followPastDue: 99,
    });
    expect(tasks.map((t) => t.tone)).toEqual(['danger', 'warn', 'info']);
  });

  it('ลิสต์ว่าง → pickNextTask คืน null', () => {
    expect(pickNextTask([])).toBeNull();
  });
});
