// @vitest-environment node
/**
 * วันที่ในไฟล์ส่งออกเป็น "12 ต.ค. 2569" แบบเดียวกับบนจอ (เจ้าของ 12 ต.ค. 2569 "ทำวันที่ในไฟล์ Excel ส่งออกให้เป็นแบบเดียวกันด้วย")
 * + 🔴 CSV ของ Dashboard: หัว 25 ช่อง แต่แถวส่ง 26 ค่า (slaStatus ไม่มีหัว) ⇒ คอลัมน์เลื่อนทั้งไฟล์ — ล็อกให้จำนวนเท่ากัน
 */
import { describe, expect, it } from 'vitest';
import { workQueueCsvText } from '../../src/lib/dashboard/exportWorkQueue';
import { applicantExportRows, APPLICANT_EXPORT_HEADERS } from '../../src/lib/applicantExport';
import { importDateTh } from '../../src/lib/applicantImportDuplicates';
import type { DashboardWorkItem } from '../../src/lib/dashboard/types';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

describe('วันที่ในไฟล์ส่งออก', () => {
  it('🔴 CSV Dashboard: หัวกับค่าจำนวนช่องเท่ากัน · วันที่เป็น "12 ต.ค. 2569" · ว่าง = ช่องว่าง', () => {
    const item = {
      requestNo: 'R1', slaStatus: 'on_track', effectiveRequestDate: '2026-10-12', slaDueDate: '', requestDate: '2026-10-01',
      requiredDate: '2026-10-15', updatedAt: '2026-10-12',
    } as unknown as DashboardWorkItem;
    const [head, row] = workQueueCsvText([item]).replace('﻿', '').split('\n');
    const h = head.split(',');
    const r = row.split(',');
    expect(r.length).toBe(h.length);
    expect(r[h.indexOf('slaStatus')]).toBe('on_track');
    expect(r[h.indexOf('effectiveRequestDate')]).toBe('12 ต.ค. 2569');
    expect(r[h.indexOf('slaDueDate')]).toBe('');
    expect(r[h.indexOf('requiredDate')]).toBe('15 ต.ค. 2569');
  });

  it('รายงานผู้สมัคร: วันที่สมัครเป็นวันไทยเวลาไทย', () => {
    const [row] = applicantExportRows([{ created_at: '2026-09-30T20:00:00Z' } as unknown as PublicApplication]);
    expect(row[APPLICANT_EXPORT_HEADERS.indexOf('วันที่สมัคร')]).toBe('1 ต.ค. 2569');
  });

  it('ไฟล์รายชื่อซ้ำตอนนำเข้า', () => {
    expect(importDateTh('2026-09-30T20:00:00Z')).toBe('1 ต.ค. 2569');
    expect(importDateTh(null)).toBe('—');
  });
});
