import { describe, it, expect } from 'vitest';
import {
  HEALTH_THRESHOLDS,
  buildHealthChecks,
  healthAlertFor,
  humanAgo,
  levelFromAge,
  minutesSince,
  worstLevel,
  type HealthSignals,
} from '../../src/lib/systemHealth';

const NOW = new Date('2026-08-19T07:32:00.000Z'); // 14:32 เวลาไทย
const agoMin = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

const base: HealthSignals = {
  lumosPullAt: agoMin(32),
  lumosResultAt: agoMin(171),
  queueDueNow: 0,
  queueWaiting: 18,
  erpOk: true,
  erpOpenJobs: 290,
  erpCheckedAt: agoMin(1),
};

describe('minutesSince', () => {
  it('นับอายุเป็นนาที · ไม่มีค่า = null', () => {
    expect(minutesSince(agoMin(90), NOW)).toBe(90);
    expect(minutesSince(null, NOW)).toBeNull();
    expect(minutesSince('ไม่ใช่วันที่', NOW)).toBeNull();
  });
  it('เวลาในอนาคตไม่ติดลบ', () => {
    expect(minutesSince(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe(0);
  });
});

describe('humanAgo', () => {
  it('อ่านออกทุกช่วง', () => {
    expect(humanAgo(null)).toBe('ยังไม่เคย');
    expect(humanAgo(0)).toBe('เมื่อกี้');
    expect(humanAgo(32)).toBe('32 นาทีก่อน');
    expect(humanAgo(171)).toBe('2 ชม. 51 น.');
    expect(humanAgo(120)).toBe('2 ชม.ก่อน');
    expect(humanAgo(60 * 24 * 3 + 5)).toBe('3 วันก่อน');
  });
});

describe('levelFromAge', () => {
  const th = { warn: 180, down: 720 };
  it('ยิ่งเก่ายิ่งแย่', () => {
    expect(levelFromAge(30, th)).toBe('ok');
    expect(levelFromAge(179, th)).toBe('ok');
    expect(levelFromAge(180, th)).toBe('warn');
    expect(levelFromAge(719, th)).toBe('warn');
    expect(levelFromAge(720, th)).toBe('down');
  });
  it('🔴 ไม่เคยเกิดขึ้นเลย = warn ไม่ใช่ ok (ห้ามตีความว่าสบายดี)', () => {
    expect(levelFromAge(null, th)).toBe('warn');
  });
});

describe('buildHealthChecks', () => {
  it('สถานะปกติ = เขียวหมด', () => {
    const checks = buildHealthChecks(base, NOW);
    expect(checks.map((c) => c.level)).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(checks[0].value).toBe('32 นาทีก่อน');
    expect(checks[3].value).toBe('290 ใบเปิด');
  });

  it('🔴 เคสจริงต้น ส.ค.: Lumos หยุดดึงคิว 3 วัน แล้วคิวบวม → แดงทั้งคู่', () => {
    const checks = buildHealthChecks(
      { ...base, lumosPullAt: agoMin(60 * 24 * 3), queueDueNow: 3400 },
      NOW,
    );
    const byKey = Object.fromEntries(checks.map((c) => [c.key, c.level]));
    expect(byKey.lumosPull).toBe('down');
    expect(byKey.queueBacklog).toBe('down');
    expect(worstLevel(checks)).toBe('down');
  });

  it('คิวรอเวลานัดไม่ใช่ปัญหา — ต้องเขียวและบอกจำนวนไว้ในบรรทัดเล็ก', () => {
    const c = buildHealthChecks({ ...base, queueDueNow: 0, queueWaiting: 18 }, NOW);
    const backlog = c.find((x) => x.key === 'queueBacklog')!;
    expect(backlog.level).toBe('ok');
    expect(backlog.hint).toContain('18');
  });

  it('อ่าน ERP ไม่ได้ = แดงทันที ไม่ต้องรอเวลา', () => {
    const c = buildHealthChecks({ ...base, erpOk: false }, NOW);
    expect(c.find((x) => x.key === 'erp')!.level).toBe('down');
  });

  it('ยามเฝ้ายังไม่เดินสักรอบ = เหลือง (ไม่รู้สถานะ ≠ ปกติ)', () => {
    const c = buildHealthChecks({ ...base, erpOk: null, erpCheckedAt: null }, NOW);
    expect(c.find((x) => x.key === 'erp')!.level).toBe('warn');
  });

  it('ผลโทรเงียบเกินเกณฑ์ → เหลือง แล้วแดงเมื่อเงียบนานมาก', () => {
    expect(
      buildHealthChecks({ ...base, lumosResultAt: agoMin(HEALTH_THRESHOLDS.lumosResult.warn) }, NOW)
        .find((c) => c.key === 'lumosResult')!.level,
    ).toBe('warn');
    expect(
      buildHealthChecks({ ...base, lumosResultAt: agoMin(HEALTH_THRESHOLDS.lumosResult.down) }, NOW)
        .find((c) => c.key === 'lumosResult')!.level,
    ).toBe('down');
  });
});

describe('worstLevel', () => {
  it('เอาอันที่แย่ที่สุด', () => {
    expect(worstLevel([{ level: 'ok' }, { level: 'warn' }])).toBe('warn');
    expect(worstLevel([{ level: 'warn' }, { level: 'down' }])).toBe('down');
    expect(worstLevel([{ level: 'ok' }])).toBe('ok');
    expect(worstLevel([])).toBe('ok');
  });
});

describe('healthAlertFor', () => {
  const check = buildHealthChecks({ ...base, lumosPullAt: agoMin(60 * 24) }, NOW).find(
    (c) => c.key === 'lumosPull',
  )!;

  it('เพิ่งพัง → เตือน', () => {
    expect(healthAlertFor(check, 'ok')?.kind).toBe('down');
    expect(healthAlertFor(check, null)?.kind).toBe('down');
  });
  it('🔴 พังอยู่แล้วไม่เตือนซ้ำ (กันสแปมจนคนกดปิดโดยไม่อ่าน)', () => {
    expect(healthAlertFor(check, 'warn')).toBeNull();
    expect(healthAlertFor(check, 'down')).toBeNull();
  });
  it('🔴 หายแล้วต้องบอกด้วย', () => {
    const okCheck = buildHealthChecks(base, NOW).find((c) => c.key === 'lumosPull')!;
    expect(healthAlertFor(okCheck, 'down')?.kind).toBe('recovered');
    expect(healthAlertFor(okCheck, 'ok')).toBeNull();
  });
});
