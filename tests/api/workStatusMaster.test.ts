import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BUILTIN_WORK_STATUSES } from '../../api/_lib/workStatusMaster';
import {
  UNIT_REQUEST_WORK_STATUS_OPTIONS,
  UNIT_REQUEST_WORK_STATUS_LABELS,
  UNIT_REQUEST_WORK_STATUS_DATE_LABELS,
} from '../../src/lib/unitRequestWorkStatus';

const root = path.join(import.meta.dirname, '../..');
const migration = fs.readFileSync(
  path.join(root, 'migrations/062_work_status_master.sql'),
  'utf8',
);

describe('work status master — ค่า built-in ต้องตรงกันทั้ง 3 ที่', () => {
  it('fallback ฝั่ง API ตรงกับค่าที่ client ใช้ (code/label/date_label)', () => {
    expect(BUILTIN_WORK_STATUSES.map((s) => s.code)).toEqual([
      ...UNIT_REQUEST_WORK_STATUS_OPTIONS,
    ]);
    for (const s of BUILTIN_WORK_STATUSES) {
      expect(s.label).toBe(UNIT_REQUEST_WORK_STATUS_LABELS[s.code]);
      expect(s.date_label).toBe(UNIT_REQUEST_WORK_STATUS_DATE_LABELS[s.code]);
      expect(s.is_builtin).toBe(true);
    }
  });

  it('migration seed ครบทุก code ที่โค้ดอ้าง — ไม่งั้น FK จะทำให้บันทึกสถานะนั้นพัง', () => {
    for (const code of UNIT_REQUEST_WORK_STATUS_OPTIONS) {
      expect(migration).toContain(`'${code}'`);
    }
  });

  it('migration ต้อง seed ก่อนผูก FK และรันซ้ำได้ (idempotent)', () => {
    const seedAt = migration.indexOf('insert into work_status_master');
    const fkAt = migration.indexOf('add constraint siamraj_unit_work_status_status_fkey');
    expect(seedAt).toBeGreaterThan(-1);
    expect(fkAt).toBeGreaterThan(seedAt);
    expect(migration).toContain('create table if not exists work_status_master');
    expect(migration).toContain('on conflict (code) do nothing');
    expect(migration).toContain('drop constraint if exists siamraj_unit_work_status_status_fkey');
    // ลบ master ที่มีใบขออ้างอยู่ต้องถูกกันไว้ที่ระดับฐานข้อมูลด้วย ไม่ใช่เชื่อแค่โค้ด
    expect(migration).toContain('on delete restrict');
  });

  it('ยกเลิก CHECK constraint เดิมที่ hardcode ค่า (ไม่งั้นเพิ่มสถานะใหม่แล้วบันทึกไม่ได้)', () => {
    expect(migration).toContain('drop constraint if exists siamraj_unit_work_status_status_check');
    const checkAt = migration.indexOf('siamraj_unit_work_status_status_check');
    const addCheckBack = migration.indexOf('add constraint siamraj_unit_work_status_status_check');
    expect(checkAt).toBeGreaterThan(-1);
    expect(addCheckBack).toBe(-1);
  });
});
