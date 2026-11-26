// @vitest-environment node
/**
 * จับคู่ให้เองเฉพาะใบ "ดำเนินการ" — ใบสถานะอื่นต้องกด "ค้นหาใหม่" เอง
 * (เจ้าของ 26 พ.ย. 2569 *"ส่วนใบอื่นนอกจากดำเนินการสรรหา ไม่ match ให้เองต้องเข้าไปกด สั่ง match เอง"*)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/siamrajUnitWorkStatus.js', () => ({
  getUnitWorkStatusMap: vi.fn(async (keys: string[]) => {
    const m = new Map<string, { status: string }>();
    if (keys.includes('OPL6911035')) m.set('OPL6911035', { status: 'on_hold' });
    if (keys.includes('LAO6910013')) m.set('LAO6910013', { status: 'in_progress' });
    if (keys.includes('siamraj-pre:LBM6910007')) m.set('siamraj-pre:LBM6910007', { status: 'waiting_start' });
    return m;
  }),
}));
vi.mock('../../api/_lib/siamrajSqlServerPrequests.js', () => ({ PREQUEST_ID_PREFIX: 'siamraj-pre:' }));

const { autoMatchJobIds, isAutoMatchWorkStatus } = await import('../../api/_lib/autoMatchScope');

describe('ใบไหนระบบจับคู่ให้เอง', () => {
  it('ดำเนินการ / ยังไม่ตั้งสถานะ = ให้เอง · สถานะอื่น = ต้องกดเอง', () => {
    expect(isAutoMatchWorkStatus('in_progress')).toBe(true);
    expect(isAutoMatchWorkStatus(null)).toBe(true);
    for (const s of ['on_hold', 'evaluating', 'waiting_inform', 'waiting_interview', 'waiting_result', 'waiting_start', 'daily_work', 'daily_pay']) {
      expect(isAutoMatchWorkStatus(s)).toBe(false);
    }
  });
  it('อ่านสถานะจากตาราง (คีย์เลขใบขอ · ใบขอชั่วคราวคีย์ของตัวเอง) · ใบที่แนบสถานะมาแล้วใช้ค่านั้น', async () => {
    const ids = await autoMatchJobIds([
      { id: 'siamraj-sql:OPL6911035', request_no: 'OPL6911035' },
      { id: 'siamraj-sql:LAO6910013', request_no: 'LAO6910013' },
      { id: 'siamraj-sql:OPL6911099', request_no: 'OPL6911099' },
      { id: 'siamraj-pre:LBM6910007', request_no: 'LBM6910007' },
      { id: 'siamraj-sql:LBA6911012', request_no: 'LBA6911012', work_status: 'waiting_inform' },
    ]);
    expect([...ids].sort()).toEqual(['siamraj-sql:LAO6910013', 'siamraj-sql:OPL6911099']);
  });
});

describe('คิวหลังบ้าน', () => {
  it('คนกดค้นหาใหม่ = manual · ใบที่อยู่ในคิวแล้วอัปเกรดเป็น manual ได้', async () => {
    const { applyEnqueue } = await import('../../api/_lib/matchPrecomputeWorker');
    const q = new Map();
    applyEnqueue(q, [{ job: { id: 'siamraj-sql:OPL6911035' }, refresh: false }]);
    expect(q.get('siamraj-sql:OPL6911035').manual).toBeUndefined();
    applyEnqueue(q, [{ job: { id: 'siamraj-sql:OPL6911035' }, refresh: true, manual: true }]);
    expect(q.get('siamraj-sql:OPL6911035')).toMatchObject({ refresh: true, manual: true });
  }, 30_000);
  it('สแกนดันเฉพาะใบดำเนินการ · ตอนหยิบจากคิวใบที่ระบบดันเองแต่สถานะอื่น = ข้าม', () => {
    const w = readFileSync('api/_lib/matchPrecomputeWorker.ts', 'utf8');
    expect(w).toContain('const autoIds = await autoMatchJobIds(jobs);');
    expect(w).toContain('if (!id || !autoIds.has(id)) continue;');
    expect(w).toContain("if (!entry.manual && !(await autoMatchJobIds([{ ...entry.job, id }])).has(id)) {");
  });
});

describe('หน้าจับคู่', () => {
  it('เปิดใบสถานะอื่น: ไม่ดันเข้าคิว ไม่โชว์ผลเก่า บอกให้กด · กดค้นหาใหม่ = manual', () => {
    const h = readFileSync('api/_handlers/matching-board-candidates.ts', 'utf8');
    const gate = h.indexOf('if (!refresh && !(await autoMatchJobIds(');
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(h.indexOf('enqueuePrecomputeJobs([{'));
    expect(h).toContain('manual_only: true');
    expect(h).toContain('manual: refresh,');
    expect(h).toContain('isPrecomputeQueuedOrRunning(jobId)');
    const page = readFileSync('src/pages/matching/MatchingPage.tsx', 'utf8');
    expect(page).toContain('data-testid="match-manual-only"');
  });
  it('ตัวเลขบนการ์ดรายการใบขอไม่นับผลเก่าของใบที่ไม่จับคู่ให้เอง และใบ ERP ขาดข้อมูล', () => {
    const l = readFileSync('api/_handlers/matching-list.ts', 'utf8');
    expect(l).toContain('if (blocked || (!isAutoMatchWorkStatus(j.work_status) && isBoardMatchFromOldPool(entry.computedAt))) tierMap.delete(j.id);');
  });
});
