// @vitest-environment node
/**
 * ═══ ใครอยู่ในระบบ — ท้ายหน้าหลัก (เจ้าของสั่ง 30 ก.ย. 2569) ═══
 * Choice: Online = **ใช้งานล่าสุด** (เข้าระบบหรือบันทึกงานใน 30 นาที) · หัวหน้ากับผู้ดูแลเห็นชื่อ คนอื่นเห็นแค่ยอด
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. เข้าระบบนับทุกทาง — Microsoft เป็นทางหลักแล้ว (เดิมนับแต่รหัสผ่าน ⇒ 22 บัญชีขึ้น "ยังไม่เคยเข้าระบบ" ผิด ๆ)
 * 2. บัญชีที่ปิดแล้วไม่อยู่ในรายชื่อ
 * 3. คนที่ไม่มีสิทธิ์ห้ามได้ชื่อไปแม้แต่ในข้อมูลที่ส่งกลับ
 * 4. แยก BU (รอบ 5) รวมกันต้องเท่ายอดทั้งหมด — ไม่มีคนหล่นหาย · ไม่ระบุ BU อยู่ท้ายสุด
 */
import { describe, expect, it } from 'vitest';
import { AUTH_SESSION_AUDIT_ACTIONS } from '../../api/_lib/authActions.js';
import { ACTIVITY_SOURCES, lastLoginSql, recentActivitySql } from '../../api/_lib/userActivitySql.js';
import { buildHomePresence } from '../../api/_handlers/home-presence.js';
import {
  activeAgoText,
  buildPresencePeople,
  countPresence,
  countPresenceByBu,
  lastLoginText,
  presenceStatus,
  sortPresence,
  type PresencePerson,
} from '../../src/lib/homePresence.js';

const NOW = new Date('2026-09-30T05:00:00Z'); // 12:00 น. เวลาไทย
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe('สถานะ', () => {
  it('ใช้งานใน 30 นาที = Online', () => {
    expect(presenceStatus({ lastLoginAt: minsAgo(300), lastActiveAt: minsAgo(5) }, NOW)).toBe('online');
    expect(presenceStatus({ lastLoginAt: null, lastActiveAt: minsAgo(30) }, NOW)).toBe('online');
  });
  it('เกิน 30 นาที หรือไม่มีร่องรอยช่วงนั้น แต่เคยเข้าระบบ = Offline', () => {
    expect(presenceStatus({ lastLoginAt: minsAgo(300), lastActiveAt: minsAgo(31) }, NOW)).toBe('offline');
    expect(presenceStatus({ lastLoginAt: minsAgo(3000), lastActiveAt: null }, NOW)).toBe('offline');
  });
  it('ไม่เคยเข้าระบบเลย = ยังไม่เข้าระบบ', () => {
    expect(presenceStatus({ lastLoginAt: null, lastActiveAt: null }, NOW)).toBe('never');
  });
});

describe('รายชื่อ', () => {
  const accounts = [
    { id: 'a', name: 'ก', bu: 'LBD', role: 'staff', active: true },
    { id: 'b', name: 'ข', bu: 'LBA', role: 'staff', active: true },
    { id: 'c', name: 'ค', bu: 'LM', role: 'staff', active: true },
    { id: 'd', name: 'ง', bu: 'LBD', role: 'staff', active: false },
  ];
  const logins = new Map([
    ['a', minsAgo(60)],
    ['b', minsAgo(24 * 60)],
  ]);
  const recent = new Map([['a', minsAgo(2)]]);

  it('บัญชีที่ปิดแล้วไม่อยู่ในรายชื่อ · สถานะถูกคน', () => {
    const people = buildPresencePeople(accounts, logins, recent, NOW);
    expect(people.map((p) => [p.id, p.status])).toEqual([
      ['a', 'online'],
      ['b', 'offline'],
      ['c', 'never'],
    ]);
    expect(countPresence(people)).toEqual({ total: 3, online: 1, offline: 1, never: 1 });
  });

  it('เรียง Online ก่อน → Offline (เข้าล่าสุดอยู่บน) → ยังไม่เข้าระบบ', () => {
    const p = (id: string, status: PresencePerson['status'], lastLoginAt: string | null): PresencePerson => ({
      id,
      name: id,
      bu: 'LBD',
      role: 'staff',
      status,
      lastLoginAt,
      lastActiveAt: status === 'online' ? minsAgo(1) : null,
    });
    const sorted = sortPresence([p('x', 'never', null), p('y', 'offline', minsAgo(500)), p('z', 'offline', minsAgo(50)), p('w', 'online', minsAgo(5))]);
    expect(sorted.map((s) => s.id)).toEqual(['w', 'z', 'y', 'x']);
  });
});

describe('แยก BU (รอบ 5 · "กดแล้วแยก BU")', () => {
  const p = (id: string, bu: string, status: PresencePerson['status']): PresencePerson => ({
    id,
    name: id,
    bu,
    role: 'staff',
    status,
    lastLoginAt: status === 'never' ? null : minsAgo(90),
    lastActiveAt: status === 'online' ? minsAgo(3) : null,
  });
  const people = [
    p('1', 'LM', 'online'),
    p('2', '', 'offline'),
    p('3', 'LBD', 'online'),
    p('4', 'LBD', 'never'),
    p('5', 'XYZ', 'offline'),
    p('6', 'LBA', 'offline'),
    p('7', 'LBD', 'offline'),
  ];

  it('เฉพาะ BU ที่มีคน · เรียงตามชุดแผนก → BU อื่น → ไม่ระบุ BU ท้ายสุด', () => {
    expect(countPresenceByBu(people).map((b) => b.bu)).toEqual(['LBD', 'LBA', 'LM', 'XYZ', '']);
  });

  it('ยอดต่อ BU ถูกคน · รวมทุก BU = ยอดทั้งหมด (ไม่มีคนหล่นหาย)', () => {
    const by = countPresenceByBu(people);
    expect(by.find((b) => b.bu === 'LBD')?.counts).toEqual({ total: 3, online: 1, offline: 1, never: 1 });
    const sum = by.reduce(
      (s, b) => ({
        total: s.total + b.counts.total,
        online: s.online + b.counts.online,
        offline: s.offline + b.counts.offline,
        never: s.never + b.counts.never,
      }),
      { total: 0, online: 0, offline: 0, never: 0 },
    );
    expect(sum).toEqual(countPresence(people));
  });

  it('ไม่มีใครเลย = ว่าง', () => {
    expect(countPresenceByBu([])).toEqual([]);
  });
});

describe('ข้อความเวลา', () => {
  it('เข้าระบบล่าสุด: วันนี้ · เมื่อวาน · กี่วันก่อน · วันที่ · ไม่เคย', () => {
    expect(lastLoginText(minsAgo(60), NOW)).toMatch(/^วันนี้ /);
    expect(lastLoginText(minsAgo(24 * 60), NOW)).toMatch(/^เมื่อวาน /);
    expect(lastLoginText(minsAgo(3 * 24 * 60), NOW)).toBe('3 วันก่อน');
    expect(lastLoginText('2026-08-12T03:00:00Z', NOW)).toMatch(/2569/);
    expect(lastLoginText(null, NOW)).toBe('ยังไม่เคย');
  });
  it('ใช้งานล่าสุดของคนที่ Online', () => {
    expect(activeAgoText(minsAgo(0), NOW)).toBe('เมื่อสักครู่');
    expect(activeAgoText(minsAgo(12), NOW)).toBe('12 นาทีก่อน');
  });
});

describe('คิวรี', () => {
  it('🔴 เข้าระบบล่าสุดนับทุกทาง รวม Microsoft', () => {
    expect(AUTH_SESSION_AUDIT_ACTIONS).toContain('auth.azure_ad.success');
    for (const a of AUTH_SESSION_AUDIT_ACTIONS) expect(lastLoginSql()).toContain(`'${a}'`);
    expect(lastLoginSql()).not.toContain('failed');
  });
  it('ร่องรอย 30 นาทีล่าสุด: ทุกตาราง กรองเวลาก่อนรวม', () => {
    const sql = recentActivitySql();
    for (const [t, u, at] of ACTIVITY_SOURCES) {
      // ชื่อตารางอาจมี schema นำหน้า ("jarvis_rm".audit_logs) ตามค่าแวดล้อม
      expect(sql).toMatch(new RegExp(`from (?:"[^"]+"\\.)?${t}\\b`));
      expect(sql).toContain(`${u} is not null and ${at} >= $1::timestamptz`);
    }
  });
  it('บัญชีที่ยังไม่ผูกแผนก = บอกเหตุ ไม่ยิงฐาน', async () => {
    const body = await buildHomePresence({ mode: 'none' }, true, NOW);
    expect(body.error).toMatch(/ผูกแผนก/);
    expect(body.people).toBeNull();
    expect(body.counts).toBeNull();
    expect(body.by_bu).toBeNull();
  });
});
