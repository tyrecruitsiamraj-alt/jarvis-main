// @vitest-environment node
/**
 * ตัวตั้งเวลาย้ายใบสมัคร — คุมสองอย่างที่พลาดแล้วเจ็บ:
 * 1) ปิดอยู่ต้อง**ไม่เดินเลย** (ค่าเริ่มต้นของ env ที่ไม่ได้ตั้ง)
 * 2) เปิด worker แล้วยัง**ไม่ย้ายจริง** จนกว่าจะสั่ง APPLY ต่างหาก
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ⚠️ vi.mock ถูกยกไปบนสุดของไฟล์ — ประกาศ vi.fn() ไว้ข้างนอกแล้วอ้างในโรงงานจะพัง
// (Cannot access before initialization) ต้องสร้างในโรงงานแล้วดึงกลับมาด้วย vi.mocked
vi.mock('../../api/_lib/applicationAutoMoveRunner.js', () => ({
  runApplicationAutoMove: vi.fn(),
}));
vi.mock('../../api/_lib/siamrajUnitRequests.js', () => ({
  listSiamrajUnitRequests: vi.fn(),
}));
vi.mock('../../api/_lib/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { runApplicationAutoMove as runApplicationAutoMoveRaw } from '../../api/_lib/applicationAutoMoveRunner.js';
import { listSiamrajUnitRequests as listSiamrajUnitRequestsRaw } from '../../api/_lib/siamrajUnitRequests.js';

const runApplicationAutoMove = vi.mocked(runApplicationAutoMoveRaw);
const listSiamrajUnitRequests = vi.mocked(listSiamrajUnitRequestsRaw);

import {
  getAutoMoveWorkerConfig,
  getLastAutoMoveRun,
  runAutoMoveOnce,
  startApplicationAutoMoveWorker,
  stopApplicationAutoMoveWorker,
} from '../../api/_lib/applicationAutoMoveWorker.js';

const ENV_KEYS = [
  'APPLICATION_AUTO_MOVE_ENABLED',
  'APPLICATION_AUTO_MOVE_APPLY',
  'APPLICATION_AUTO_MOVE_INTERVAL_MS',
  'APPLICATION_AUTO_MOVE_STARTUP_DELAY_MS',
  'APPLICATION_AUTO_MOVE_LIMIT',
];

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  runApplicationAutoMove.mockReset();
  listSiamrajUnitRequests.mockReset();
  listSiamrajUnitRequests.mockResolvedValue([
    { id: 'siamraj-sql:OPL1', request_no: 'OPL1', status: 'open', location_address: '' },
    { id: 'siamraj-sql:OPL2', request_no: 'OPL2', status: 'closed', location_address: '' },
  ]);
  runApplicationAutoMove.mockResolvedValue({
    scanned: 2,
    moved: 1,
    skipped: 1,
    reasons: { 'ไม่มีใบปลายทาง': 1 },
    details: [
      {
        applicationId: 'a1',
        applicant: 'สมชาย',
        from: 'siamraj-sql:OPL9',
        to: 'siamraj-sql:OPL1',
        reason: 'same_province',
      },
    ],
  });
});

afterEach(() => stopApplicationAutoMoveWorker());

describe('ค่าตั้งของ worker', () => {
  it('🔴 ไม่ได้ตั้ง env = ปิด และ start() ต้องคืน false (ไม่แตะข้อมูลใคร)', () => {
    expect(getAutoMoveWorkerConfig().enabled).toBe(false);
    expect(startApplicationAutoMoveWorker()).toBe(false);
    expect(runApplicationAutoMove).not.toHaveBeenCalled();
  });

  it('เปิดแล้ว start() คืน true', () => {
    process.env.APPLICATION_AUTO_MOVE_ENABLED = 'true';
    // หน่วงตอนบูตยาว ๆ เพื่อไม่ให้รอบแรกวิ่งระหว่างเทสต์ — เราตรวจแค่ว่ามันติด
    process.env.APPLICATION_AUTO_MOVE_STARTUP_DELAY_MS = '600000';
    expect(startApplicationAutoMoveWorker()).toBe(true);
    stopApplicationAutoMoveWorker();
  });
});

describe('runAutoMoveOnce', () => {
  it('🔴 ค่าเริ่มต้นคือ dryRun — เปิด worker เฉย ๆ ต้องไม่ย้ายจริง', async () => {
    process.env.APPLICATION_AUTO_MOVE_ENABLED = 'true';
    const state = await runAutoMoveOnce();
    expect(runApplicationAutoMove).toHaveBeenCalledWith(expect.anything(), {
      dryRun: true,
      limit: 200,
    });
    expect(state.dryRun).toBe(true);
    expect(state.moved).toBe(1);
  });

  it('สั่ง APPLY แล้วถึงจะเขียนจริง', async () => {
    process.env.APPLICATION_AUTO_MOVE_ENABLED = 'true';
    process.env.APPLICATION_AUTO_MOVE_APPLY = 'true';
    const state = await runAutoMoveOnce();
    expect(runApplicationAutoMove).toHaveBeenCalledWith(expect.anything(), {
      dryRun: false,
      limit: 200,
    });
    expect(state.dryRun).toBe(false);
  });

  it('🔴 ส่งให้ตัวจับคู่เฉพาะใบที่ยังเปิด — ใบปิดต้องไม่กลายเป็นปลายทาง', async () => {
    await runAutoMoveOnce();
    const jobs = runApplicationAutoMove.mock.calls[0][0] as ReadonlyArray<{ id: string }>;
    expect(jobs.map((j) => j.id)).toEqual(['siamraj-sql:OPL1']);
  });

  it('เก็บผลรอบล่าสุดไว้ให้หน้าเว็บอ่าน — พร้อมชื่อคนและใบต้นทาง/ปลายทาง', async () => {
    await runAutoMoveOnce();
    const last = getLastAutoMoveRun();
    expect(last?.details[0]).toMatchObject({
      applicant: 'สมชาย',
      from: 'siamraj-sql:OPL9',
      to: 'siamraj-sql:OPL1',
    });
    expect(last?.openJobs).toBe(1);
    expect(last?.error).toBeNull();
  });

  it('🔴 รอบที่ล้มต้องบันทึกว่าล้ม ไม่ใช่ปล่อยให้เห็นผลรอบเก่าแล้วนึกว่ายังดีอยู่', async () => {
    await runAutoMoveOnce();
    expect(getLastAutoMoveRun()?.moved).toBe(1);

    listSiamrajUnitRequests.mockRejectedValueOnce(new Error('อ่าน ERP ไม่ได้'));
    const state = await runAutoMoveOnce();
    expect(state.error).toBe('อ่าน ERP ไม่ได้');
    expect(state.moved).toBe(0);
    expect(state.details).toEqual([]);
  });
});
