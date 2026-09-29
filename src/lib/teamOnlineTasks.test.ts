/**
 * งานที่ต้องทำต่อของหน้าทีม Online — 🔴 ด่าน "กดแล้วต้องเจอเลขเท่ากัน"
 * - นับจากยอดทั้งสิทธิ์ (`scope` / `backlogScope`) ไม่ใช่ยอดตามตัวกรอง BU ของหน้า — หน้าปลายทางไม่มีตัวกรอง BU
 * - ปลายทาง = ลิงก์ของพจนานุกรมเลข (เลนกล่องงาน / ถังหน้ารายชื่อ) ที่เดียว
 * - 0 = ไม่มีบรรทัด · ยังโหลดไม่ได้ = ไม่มีบรรทัด (ห้ามเดา)
 */
import { describe, expect, it } from 'vitest';
import { METRICS } from './metricDictionary';
import type { TeamOnlineResponse } from './teamOnline';
import { onlineTasks } from './teamOnlineTasks';

const lane = (over: Record<string, number>) => ({ sourcing: 0, publish: 0, silent: 0, ...over });
const stages = (over: Record<string, number>) => ({
  untouched: 0,
  held: 0,
  in_queue: 0,
  contact_failed: 0,
  success_unscheduled: 0,
  scheduled: 0,
  ...over,
});

const make = (o: { scope?: object; total?: object; backlogScope?: object; backlog?: object }) =>
  ({
    lanes: o.scope || o.total ? { scope: o.scope, total: o.total } : null,
    applicants: o.backlogScope || o.backlog ? { backlogScope: o.backlogScope, backlog: o.backlog } : null,
  }) as unknown as TeamOnlineResponse;

describe('งานของทีม Online', () => {
  it('ครบสี่งาน · ปลายทางตรงพจนานุกรม (เลนกล่องงาน / ถังรายชื่อ)', () => {
    const tasks = onlineTasks(
      make({
        scope: lane({ sourcing: 320, publish: 8, silent: 3 }),
        backlogScope: { stages: stages({ success_unscheduled: 54 }), over5d: 15 },
      }),
    );
    expect(tasks.map((t) => [t.key, t.count, t.tone, t.path])).toEqual([
      ['online-unscheduled', 54, 'danger', METRICS['teamOnline.unscheduled'].href],
      ['online-publish', 8, 'warn', METRICS['teamOnline.lanePublish'].href],
      ['online-silent', 3, 'warn', METRICS['teamOnline.laneSilent'].href],
      ['online-sourcing', 320, 'info', METRICS['teamOnline.laneSourcing'].href],
    ]);
    expect(tasks.map((t) => t.path)).toEqual([
      '/jobs/board?view=list&bucket=success_unscheduled',
      '/jobs/board?lane=unreleased&step=publish',
      '/jobs/board?lane=silent',
      '/jobs/board?lane=sourcing',
    ]);
  });

  it('🔴 นับจากยอดทั้งสิทธิ์ ไม่ใช่ยอดตามตัวกรอง BU ของหน้า (กล่องงาน/หน้ารายชื่อไม่มีตัวกรอง BU)', () => {
    const tasks = onlineTasks(
      make({
        scope: lane({ silent: 9 }),
        total: lane({ silent: 2 }),
        backlogScope: { stages: stages({ success_unscheduled: 7 }), over5d: 0 },
        backlog: { stages: stages({ success_unscheduled: 1 }), over5d: 0 },
      }),
    );
    expect(tasks.find((t) => t.key === 'online-silent')?.count).toBe(9);
    expect(tasks.find((t) => t.key === 'online-unscheduled')?.count).toBe(7);
  });

  it('0 หรือยังโหลดไม่ได้ = ไม่มีบรรทัด · ไม่ซ้อนถัง "เกิน 5 วัน" กับ "ยังไม่มีใครแตะ" ของหน้าหลัก', () => {
    expect(onlineTasks(null)).toEqual([]);
    expect(onlineTasks(make({ scope: lane({}), backlogScope: { stages: stages({}), over5d: 40 } }))).toEqual([]);
  });
});
