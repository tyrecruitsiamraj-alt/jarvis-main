// @vitest-environment node
/**
 * ส่งคนแทนแบบ Spare บนหน้าใบขอ (เจ้าของ 27 ต.ค. 2569 "ช่องส่งคนแทนเพิ่ม spare" · Choice "ตัวเลือกที่ 4 นับเป็นต้องส่งคนแทน")
 * 🔴 Spare = send_replacement true + replacement_spare true ⇒ ตัวกรอง/ตัวเลขต้องส่งคนแทนนับรวมเอง
 * 🔴 เปลี่ยนเป็นไม่ส่ง/ยังไม่ระบุ = ล้าง Spare (ห้ามค้าง Spare บนใบที่ไม่ส่งคนแทน)
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/postgres.js')>();
  return { ...mod, dbQuery: (...a: unknown[]) => dbQuery(...a) };
});

import { upsertUnitNote } from '../../api/_lib/siamrajUnitNotes.js';

let existing: Record<string, unknown> | null = null;
beforeEach(() => {
  existing = null;
  dbQuery.mockReset().mockImplementation(async (sql: string, params?: unknown[]) => {
    if (/limit 0/.test(sql)) return { rows: [] };
    if (/^\s*insert/i.test(sql)) {
      const cols = /insert into \S+ \(([^)]+)\)/.exec(sql)![1].split(', ');
      const row: Record<string, unknown> = { updated_at: null };
      cols.forEach((c, i) => {
        if (c === 'request_no') row[c] = params![0];
        else if (c !== 'updated_at' && c !== 'updated_by_user_id') row[c] = params![i];
      });
      existing = row;
      return { rows: [row] };
    }
    return { rows: existing ? [existing] : [] };
  });
});

describe('upsertUnitNote · Spare', () => {
  it('เลือก Spare = ต้องส่งคนแทน + Spare', async () => {
    const n = await upsertUnitNote({ requestNo: 'LBD6910001', send_replacement: true, replacement_spare: true });
    expect([n.send_replacement, n.replacement_spare]).toEqual([true, true]);
  });
  it('เปลี่ยนเป็นไม่ต้องส่งคนแทน = Spare หลุดเอง แม้ส่ง spare มา', async () => {
    await upsertUnitNote({ requestNo: 'LBD6910001', send_replacement: true, replacement_spare: true });
    const n = await upsertUnitNote({ requestNo: 'LBD6910001', send_replacement: false, replacement_spare: true });
    expect([n.send_replacement, n.replacement_spare]).toEqual([false, false]);
  });
  it('แก้หมายเหตุอย่างเดียว = Spare เดิมอยู่ครบ', async () => {
    await upsertUnitNote({ requestNo: 'LBD6910001', send_replacement: true, replacement_spare: true });
    const n = await upsertUnitNote({ requestNo: 'LBD6910001', note: 'โทรก่อน' });
    expect([n.send_replacement, n.replacement_spare]).toEqual([true, true]);
  });
});

describe('หน้าจอ', () => {
  it('dropdown มี 4 ตัวเลือก · ป้ายรายการขึ้น Spare', () => {
    const sel = readFileSync('src/components/jobs/UnitRequestReplacementToggle.tsx', 'utf8');
    expect(sel).toContain('<SelectItem value="spare">Spare</SelectItem>');
    expect(sel).toMatch(/v === 'yes' \|\| v === 'spare', v === 'spare'/);
    const badge = readFileSync('src/components/jobs/UnitRequestReplacementBadge.tsx', 'utf8');
    expect(badge).toContain("spare ? 'Spare' : 'ต้องส่งคนแทน'");
    expect(readFileSync('src/pages/jobs/JobListPage.tsx', 'utf8')).toContain('spare={j.replacement_spare}');
  });
});
