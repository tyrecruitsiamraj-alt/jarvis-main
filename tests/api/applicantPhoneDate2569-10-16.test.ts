/**
 * แท็บผู้สมัคร (ตารางแบบมีคอลัมน์เจ้าของงาน) — เจ้าของ 16 ต.ค. 2569
 * "เอาเบอร์โทรมาโชว์ด้วย" + "เอาวันที่สมัครมาด้วย"
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync('src/components/recruit-rm/RmTable.tsx', 'utf8');

describe('ตารางผู้สมัคร: เบอร์โทร + วันที่สมัคร', () => {
  it('มีหัวคอลัมน์เบอร์โทรต่อจากนามสกุล · หัว "วันที่สมัคร"', () => {
    expect(src).toMatch(/>นามสกุล<\/th>\s*<th className="px-1\.5 py-2 font-medium">เบอร์โทร<\/th>/);
    expect(src).toContain('>วันที่สมัคร</th>');
  });

  it('จำนวนคอลัมน์ของแถวว่างตามหัวตาราง (11 ช่องในโฉมนี้)', () => {
    expect(src).toContain('(ownerColumns ? 11 : 4)');
  });

  it('ช่องเบอร์ขึ้นเบอร์ + ป้ายเบอร์ใช้โทรไม่ได้ · ช่องวันที่ขึ้นวันที่ตามปฏิทินกรุงเทพ + ผ่านมากี่วัน', () => {
    expect(src).toContain("<span className={cn('whitespace-nowrap tabular-nums', DASH.cell)}>{dashIfEmpty(r.phone)}</span>");
    expect(src).toContain("<span className={cn('text-xs tabular-nums', DASH.cellMuted)}>{daysAppliedText(r.created_at, now)}</span>");
  });
});
