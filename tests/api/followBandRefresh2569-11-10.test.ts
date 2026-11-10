// @vitest-environment node
/**
 * หน้าติดตาม: รอบรีเฟรช 25 วิดึงเฉพาะสายช่วงนี้ (เจ้าของ 10 พ.ย. 2569 Choice "รอบ 25 วิดึงเฉพาะสายช่วงนี้")
 * วัดบนเว็บจริง: เดิมโหลดทั้ง 16,047 สาย (9 คำขอ) ทุก 25 วิต่อหน้าที่เปิดค้าง · ช่วงนี้ = 1,155 สาย คำขอเดียว
 * + ภาพรวมยิงใบขอติดตรงไหนพร้อมก้อนภาพรวม (เดิมรอกันเป็นทอด สมการบนสุดขึ้นที่ 10.7 วิ)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFollowBand } from '../../api/_handlers/follow.js';
import { followRefreshBand, mergeFollowBand, type FollowEntry } from '../../src/lib/followApi.js';

describe('ช่วงของรอบรีเฟรช', () => {
  it('3 วันก่อน → สิ้นวันพรุ่งนี้เวลาไทย · สายที่สร้างตั้งแต่รอบก่อน', () => {
    const b = followRefreshBand(new Date('2026-11-10T02:20:00.000Z'), new Date('2026-11-10T02:17:00.000Z'));
    expect(b).toEqual({ from: '2026-11-07T02:20:00.000Z', to: '2026-11-11T17:00:00.000Z', since: '2026-11-10T02:17:00.000Z' });
    // ห้าทุ่มครึ่งเวลาไทย ยังเป็นวันเดิม — สิ้นพรุ่งนี้ยังเป็นเที่ยงคืนต้นวันที่ 12
    expect(followRefreshBand(new Date('2026-11-10T16:30:00.000Z'), new Date()).to).toBe('2026-11-11T17:00:00.000Z');
  });
  it('server: ไม่ส่ง = ทั้งตารางเดิม · ส่งไม่ครบ/อ่านไม่ออก = 400 (ไม่ถอยไปดึงทั้งตารางเงียบ ๆ)', () => {
    expect(parseFollowBand({})).toBeNull();
    expect(parseFollowBand({ band_from: '2026-11-07T00:00:00Z' })).toBe('bad');
    expect(parseFollowBand({ band_from: 'x', band_to: 'y', created_since: 'z' })).toBe('bad');
    expect(parseFollowBand({ band_from: '2026-11-12T00:00:00Z', band_to: '2026-11-07T00:00:00Z', created_since: '2026-11-10T00:00:00Z' })).toBe('bad');
    expect(parseFollowBand({ band_from: '2026-11-07T00:00:00Z', band_to: '2026-11-12T00:00:00Z', created_since: '2026-11-10T00:00:00Z' })).toEqual({
      from: '2026-11-07T00:00:00.000Z',
      to: '2026-11-12T00:00:00.000Z',
      since: '2026-11-10T00:00:00.000Z',
    });
  });
  it('รวมทับชุดเดิมด้วย id — สายที่เปลี่ยนได้ค่าใหม่ · สายใหม่เพิ่ม · สายนอกช่วงยังอยู่ครบ', () => {
    const row = (id: string, over: Partial<FollowEntry> = {}) =>
      ({ id, recipient_name: 'สมชาย ใจดี', recipient_phone: '+66812345678', topic: 'เริ่มงาน', scheduled_at: '2026-11-09T02:00:00.000Z', created_at: '2026-11-01T02:00:00.000Z', call_round: 1, ...over }) as FollowEntry;
    const prev = [row('0b8af7b0-0001', { call_status: 'pending' } as Partial<FollowEntry>), row('0b8af7b0-0002', { scheduled_at: '2026-10-01T02:00:00.000Z' })];
    const merged = mergeFollowBand(prev, [row('0b8af7b0-0001', { call_status: 'completed' } as Partial<FollowEntry>), row('0b8af7b0-0003')]);
    expect(merged.map((e) => e.id).sort()).toEqual(['0b8af7b0-0001', '0b8af7b0-0002', '0b8af7b0-0003']);
    expect((merged.find((e) => e.id === '0b8af7b0-0001') as Record<string, unknown>).call_status).toBe('completed');
    expect(mergeFollowBand(prev, [])).toBe(prev);
  });
  it('หน้าติดตาม: รอบ 25 วิเรียกช่วงนี้ · โหลดเต็มทุก 5 นาที · กดทำอะไรยังโหลดเต็ม', () => {
    const page = readFileSync('src/pages/follow/FollowPage.tsx', 'utf8');
    expect(page).toContain('const FULL_RELOAD_MS = 5 * 60_000;');
    expect(page).toMatch(/const tick = \(\) => \{[\s\S]*?void refreshBand\(\);/);
    expect(page).toContain('onChanged={() => void reload(true)}');
  });
});

describe('ภาพรวม: ใบขอติดตรงไหนยิงพร้อมก้อนภาพรวม', () => {
  it('ยิงล่วงหน้าด้วยช่วงตัวเดียวกับ server · รับคำขอเดิมภายใน 30 วิ ไม่ยิงซ้ำ', () => {
    const ov = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
    expect(ov).toContain('prefetchRecruitStuck(pickedBu, { from: w.from, to: w.to });');
    expect(ov).toContain('monthWindow(month, today)');
    const api = readFileSync('src/lib/recruitStuckApi.ts', 'utf8');
    expect(api).toContain('const PREFETCH_MS = 30_000;');
  });
});

describe('เปิดหน้าติดตามครั้งแรก (10 พ.ย. 2569 "ให้เร็วกว่านี้อีก")', () => {
  it('ตัดหน้าจากตารางติดตามก่อนแล้วค่อย join · ลำดับมีตัวตัดสิน (id) แถวไม่ซ้ำ/ไม่หล่นข้ามหน้า', () => {
    const h = readFileSync('api/_handlers/follow.ts', 'utf8');
    // 10 พ.ย. 2569 กรอง BU ในซับคิวรีเดียวกัน (followBuJoin · listWhere) — ยังตัดหน้าก่อน join
    expect(h).toMatch(/from \(select f\.\* from \$\{followTable\} f \$\{followBuJoin\('f'\)\} \$\{listWhere\}\s+order by f\.created_at desc, f\.id desc\s+limit \$1 offset \$2\) f/);
    expect(h).not.toMatch(/\$\{listWhere\}\s+order by f\.created_at desc\s+limit \$1 offset \$2/);
  });
});
