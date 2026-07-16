import { describe, it, expect } from 'vitest';
import { classifyLifecycleKindFromAction } from '../../src/lib/dashboard/lifecycle';
import { enrichActivityTrendWithThroughput } from '../../src/lib/dashboard/throughput';
import type { DashboardActivityTrendPoint } from '../../src/lib/dashboard/types';

describe('ERP st_ms_request lifecycle classify', () => {
  it('maps real Siamraj request codes', () => {
    expect(classifyLifecycleKindFromAction('เปิดไซด์', '001')).toBe('new_site');
    expect(classifyLifecycleKindFromAction('เพิ่มอัตรา(คน)', '002')).toBe('increase_headcount');
    expect(classifyLifecycleKindFromAction('เพิ่มตำแหน่ง', '003')).toBe('increase_headcount');
    expect(classifyLifecycleKindFromAction('เปลี่ยนคน', '004')).toBe('replacement');
    expect(classifyLifecycleKindFromAction('ลาออก', '005')).toBe('resignation');
    expect(classifyLifecycleKindFromAction('พ้นสภาพ', '006')).toBe('resignation');
    expect(classifyLifecycleKindFromAction('ลาบวช', '013')).toBe('resignation');
    expect(classifyLifecycleKindFromAction('ลาคลอด', '014')).toBe('resignation');
  });

  it('maps ERP Thai names without relying on code', () => {
    expect(classifyLifecycleKindFromAction('เปลี่ยนคน', null)).toBe('replacement');
    expect(classifyLifecycleKindFromAction('เปิดไซด์', null)).toBe('new_site');
    expect(classifyLifecycleKindFromAction('พ้นสภาพ', null)).toBe('resignation');
  });

  it('puts เปลี่ยนคน into monthly replacement intake even when lifecycleKind was other', () => {
    const points: DashboardActivityTrendPoint[] = [
      { date: '2026-01-01', label: 'ม.ค.', resignations: 0, replacements: 0, newOpenings: 0 },
    ];
    const enriched = enrichActivityTrendWithThroughput(points, [
      {
        requestDate: '2026-01-10',
        closureDate: null,
        positionUnits: 31,
        isOpen: true,
        kind: 'remaining',
        requestActionName: 'เปลี่ยนคน',
        requestActionCode: '004',
        lifecycleKind: 'other',
      },
    ]);
    expect(enriched[0]?.requestedPositions).toBe(31);
    expect(enriched[0]?.replacements).toBe(31);
    expect(enriched[0]?.other).toBe(0);
  });
});
