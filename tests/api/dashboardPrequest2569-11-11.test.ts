// @vitest-environment node
/**
 * ศูนย์ควบคุมใบขอนับใบขอชั่วคราวรวมเหมือนหน้าหลัก (เจ้าของ 11 พ.ย. 2569 "เอาแบบนับรวมเหมือนหน้าหลัก")
 * แทนข้อเคาะ 2 พ.ย. 2569 (เข้ามา/หาได้/ยกเลิก ไม่รวม)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prequestThroughputRecord } from '../../api/_lib/siamrajPrequestThroughput';

const row = (p: Partial<Parameters<typeof prequestThroughputRecord>[0]>) => ({
  prequest_no: 'LAM6910003',
  bu: 'LBA',
  unit: 'บริษัท ทดสอบ จำกัด',
  request_qty: 2,
  key_ymd: '2026-10-19',
  need_ymd: '2026-11-02',
  end_ymd: null,
  ...p,
});

describe('ใบขอชั่วคราวในข้อมูลแนวโน้ม', () => {
  it('เปิดอยู่ = เหลือหา · งวด = วันที่ต้องการคน · คีย์ไม่ชนเลขใบจริง', () => {
    const r = prequestThroughputRecord(row({}))!;
    expect(r).toMatchObject({ requestNo: 'ชั่วคราว LAM6910003', jobId: 'siamraj-pre:LAM6910003', requestDate: '2026-11-02', positionUnits: 2, isOpen: true, kind: 'remaining', departmentCode: 'LBA' });
  });
  it('ERP ปิด/แปลงเป็นใบจริง = จบ ไม่มีคนหาได้ ⇒ อัตราเป็นยกเลิก (กติกาเดียวกับสมุดใบขอหน้าหลัก)', () => {
    expect(prequestThroughputRecord(row({ end_ymd: '2026-11-05' }))).toMatchObject({ isOpen: false, kind: 'cancelled', closureDate: '2026-11-05' });
  });
  it('ไม่มีวันที่ต้องการ = ใช้วันคีย์ · ไม่มีเลขที่ = ข้าม', () => {
    expect(prequestThroughputRecord(row({ need_ymd: null }))?.requestDate).toBe('2026-10-19');
    expect(prequestThroughputRecord(row({ prequest_no: '  ' }))).toBeNull();
  });
  it('เส้นข้อมูลแนวโน้มรวมใบชั่วคราว · การ์ดเหลือหาเลิกบวกแยก (กันนับซ้ำ)', () => {
    expect(readFileSync('api/_handlers/siamraj-unit-requests.ts', 'utf8')).toContain('return res.status(200).json([...erp, ...pre]);');
    const shell = readFileSync('src/components/dashboard/analytics/DashboardShell.tsx', 'utf8');
    expect(shell).toContain("const remainingKpiValue = data.kpis.find((k) => k.id === 'remaining')?.value ?? 0;");
    expect(shell).not.toContain('data.prequestKpi?.value ?? 0 : 0');
  });
});
