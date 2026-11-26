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

describe('OPL6911103 — เคยขาดสถานที่ทำงาน ตอนนี้ ERP ครบแล้ว', () => {
  const job = { request_no: 'OPL6911103', location_address: 'หมู่บ้านชลดา ลาดกระบัง 54 เขตลาดกระบัง กรุงเทพฯ' };
  it('ที่อยู่ตอนนี้อ่านได้ ไม่ติดด่านสถานที่', () => {
    expect(jobAreaForMatch(job)).toEqual({ province: 'กรุงเทพมหานคร', district: 'ลาดกระบัง' });
    expect(matchBlockersOf(job)).not.toContain('place');
  });
  it('ผลที่บันทึกว่าขาดข้อมูล แต่ใบครบแล้ว = คิดใหม่ทันที (เปิดดู + สแกน) ไม่โชว์ไม่จับคู่ค้าง', () => {
    const view = readFileSync('api/_handlers/matching-board-candidates.ts', 'utf8');
    expect(view).toContain('const staleBlocked = stored != null && Array.isArray(stored.result.blocked) && stored.result.blocked.length > 0;');
    expect(view).toContain('(isBoardMatchFromOldPool(stored.computedAt) || staleBlocked)');
    expect(view).toContain('if (stored && !staleBlocked) {');
    const worker = readFileSync('api/_lib/matchPrecomputeWorker.ts', 'utf8');
    expect(worker).toContain('} else if (entry.blocked && matchBlockersOf(job).length === 0) {');
    expect(readFileSync('api/_lib/boardMatchStore.ts', 'utf8')).toContain("jsonb_array_length(result->'blocked') > 0) as blocked");
  });
});
