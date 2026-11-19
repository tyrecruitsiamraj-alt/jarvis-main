import { describe, expect, it } from 'vitest';
import { asOfCutoff, asOfSql } from '../../api/_lib/overviewAsOf';
import { factsSql, ageOf } from '../../api/_handlers/recruit-overview';
import { IN_QUEUE_SQL } from '../../api/_lib/applicantOverviewSql';

describe('ผล ณ วันสิ้นสุด (ภาพรวม v2 · 17 พ.ย. 2569)', () => {
  it('cutoff = ต้นวันถัดจากวันสิ้นสุด เวลาไทย · วันสิ้นสุดคือวันนี้ = ไม่ตัด', () => {
    expect(asOfCutoff('2026-11-07', '2026-11-17')).toBe('2026-11-07T17:00:00.000Z');
    expect(asOfCutoff('2026-11-17', '2026-11-17')).toBeNull();
    expect(asOfCutoff('bad', '2026-11-17')).toBeNull();
  });

  it('คิวรี facts อ่านตารางเหตุการณ์ผ่าน CTE ที่ตัดตามเวลาบันทึก · ไม่เหลืออ้างตารางจริงนอก CTE', () => {
    const sql = asOfSql(factsSql(), '$4::timestamptz');
    expect(sql.startsWith('with ov_asof_')).toBe(true);
    for (const cte of ['ov_asof_queue', 'ov_asof_holds', 'ov_asof_contacts', 'ov_asof_attendance', 'ov_asof_screening', 'ov_asof_cancellations']) {
      // not materialized — อ้างหลายครั้งแล้ว PG 13 เก็บเป็นตารางชั่วคราวไม่มีดัชนี ช่วงในอดีตเกิน 90 วิ (504 · 19 พ.ย. 2569)
      expect(sql).toContain(`${cte} as not materialized (select * from `);
    }
    const body = sql.slice(sql.indexOf('\n  select a.id'));
    // ตารางจริงเหลือแค่ในคิวรี "อยู่ในคิว ณ วันนั้น" (คิวที่ได้ผลหลัง cutoff = ยังรออยู่ ณ วันนั้น)
    const realQueue = body.match(/"[a-z_]+"\.lumos_dispatch_queue/g) ?? [];
    expect(realQueue.length).toBe(1);
    expect(body).not.toMatch(/"[a-z_]+"\.(application_contact_logs|candidate_call_holds|application_appointment_results|application_screening_results|application_cancellations)\b/);
    expect(body).not.toContain(IN_QUEUE_SQL);
    expect(body).toContain('q.first_result_at >= $4::timestamptz');
    expect(sql).toContain('created_at < $4::timestamptz');
  });

  it('อายุ = ตัวเลข 1–99 เท่านั้น · ว่าง/ผิด = ไม่ระบุ (ห้ามเป็น 0 ปี)', () => {
    expect([ageOf(38), ageOf('41'), ageOf(null), ageOf(''), ageOf('abc'), ageOf(0), ageOf(120)]).toEqual([38, 41, null, null, null, null, null]);
  });
});

describe('วิธีที่รายชื่อเข้ามา (methodOf · 17 พ.ย. 2569)', () => {
  it('ลิงก์ก่อน › iRecruit › มีคนคีย์ › กรอกเอง', async () => {
    const { methodOf } = await import('../../api/_handlers/recruit-overview');
    expect(methodOf('apply_page', 'ABC123', 'autopost', null)).toBe('autopost');
    expect(methodOf('apply_page', 'ABC123', 'manual', 'pakkorn.k@siamraj.com')).toBe('manual');
    expect(methodOf('apply_page', 'ABC123', null, null)).toBe('link');
    expect(methodOf('irecruit', null, null, 'kanyanat.y@siamraj.com')).toBe('irecruit');
    expect(methodOf('apply_page', null, null, 'pakkorn.k@siamraj.com')).toBe('staff');
    expect(methodOf('apply_page', null, null, null)).toBe('self');
  });
});
