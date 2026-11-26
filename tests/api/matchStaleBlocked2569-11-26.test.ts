// @vitest-environment node
/**
 * ผลจับคู่เก่าของใบที่ ERP ขาดข้อมูล ต้องไม่ขึ้นจอ ไม่ปล่อยสาย (เจ้าของ 26 พ.ย. 2569
 * "OPL6911035 ใบขอนี้ สถานที่ทำงาน (ที่อยู่เต็ม) ไม่มี แล้วทำไม match คนได้อะ")
 * ต้นเหตุ: ผลคิด 25 พ.ย. 20:46 ก่อนกติกาขึ้นเว็บ 22:45 · ช่องสถานที่ทำงานมีแค่ "บริษัท เอ็มจี เซลส์ (ประเทศไทย) จำกัด"
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { jobAreaForMatch, matchBlockersOf } from '../../src/lib/matchProximity';
import { isBoardMatchFromOldPool } from '../../api/_lib/boardCandidatesSql';

describe('OPL6911035 — สถานที่ทำงานมีแค่ชื่อบริษัท', () => {
  const job = { request_no: 'OPL6911035', location_address: 'บริษัท เอ็มจี เซลส์ (ประเทศไทย) จำกัด' };
  it('ไม่รู้จังหวัด = กันไม่จับคู่ · บอกว่าขาดอะไร', () => {
    expect(jobAreaForMatch(job).province).toBeNull();
    expect(matchBlockersOf(job)).toContain('place');
  });
  it('ผลที่คิดก่อนกติกาขึ้นเว็บ = เก่า ต้องแมทใหม่ · ผลหลังจากนั้นไม่ใช่', () => {
    expect(isBoardMatchFromOldPool('2026-11-25T13:46:00Z')).toBe(true);
    expect(isBoardMatchFromOldPool('2026-11-26T03:00:00Z')).toBe(false);
  });
  it('เส้นเปิดดูผลจับคู่เช็กใบก่อนอ่านผลเก่า · ตัวปล่อยชุดโทรเช็กก่อนส่ง', () => {
    const view = readFileSync('api/_handlers/matching-board-candidates.ts', 'utf8');
    expect(view.indexOf('matchBlockersOf(job')).toBeGreaterThan(0);
    expect(view.indexOf('matchBlockersOf(job')).toBeLessThan(view.indexOf('const stored = await getStoredBoardMatch(jobId)'));
    const batch = readFileSync('api/_lib/callBatchDispatcher.ts', 'utf8');
    expect(batch).toContain("logInfo('call-batch.release.blocked'");
  });
});
