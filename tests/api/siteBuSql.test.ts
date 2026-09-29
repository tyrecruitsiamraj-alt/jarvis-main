/**
 * ═══ BU จากรหัสไซต์ฝั่ง SQL — ตัวเดียวของทุกเส้น (28 ก.ย. 2569) ═══
 * เดิมเขียนนิพจน์นี้ซ้ำในแต่ละ handler · ยกมาไว้ `api/_lib/siteBuSql.ts` ตอนบอร์ดทีมหน้าแรกต้องใช้เป็นเส้นที่สาม
 * 🔴 ต้องแปลเหมือน `buFromSiteCode` (src/lib/homeBu.ts) เป๊ะ · handler ห้ามเขียน regex นี้เองอีก
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { siteBuSql, trendBuOfSiteSql, trendBuSql } from '../../api/_lib/siteBuSql';
import { normalizeTrendBu, SITE_BU_TO_DEPT, trendBuFromSiteCode } from '@/lib/trends/bu';
import { buFromSiteCode } from '@/lib/homeBu';

const ROOT = path.resolve(__dirname, '../..');
const code = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('siteBuSql', () => {
  it('ตัวอักษร 3 ตัวหลังเลขปี 2 หลัก · อ่านไม่ออก = NULL', () => {
    expect(siteBuSql('m.site_code')).toBe(
      "case when m.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(m.site_code from 3 for 3)) end",
    );
  });

  it('แปลเหมือน buFromSiteCode ฝั่งหน้าเว็บ (จำลอง regex + substring ของ SQL)', () => {
    const sqlLike = (v: string) => (/^[0-9]{2}[A-Za-z]{3}/.test(v) ? v.slice(2, 5).toUpperCase() : null);
    for (const v of ['65LBDL0143', '66LML0011', '67lbal0019', '69SNJ0002', 'LBD', '6LBD', '', 'อ่านไม่ออก']) {
      expect(sqlLike(v), v).toBe(buFromSiteCode(v));
    }
  });

  it.each([
    'api/_handlers/home-kpis.ts',
    'api/_handlers/dashboard-trends.ts',
    'api/_handlers/office-team.ts',
    'api/_handlers/office-floor.ts',
    'api/_lib/homeBuSql.ts',
  ])(
    '%s ใช้ตัวกลาง (siteBuSql ตรง ๆ หรือผ่าน homeBuSql) ไม่เขียน regex รหัสไซต์เอง',
    (f) => {
      const src = code(f);
      expect(src).toMatch(/from '\.\.?\/(_lib\/)?(siteBuSql|homeBuSql)\.js'/);
      expect(src).not.toContain('[0-9]{2}[A-Za-z]{3}');
    },
  );
});

describe('trendBuSql — BU กลางชุดแผนก ฝั่ง SQL (29 ก.ย. 2569)', () => {
  /** จำลอง CASE ของ SQL ด้วยคู่ when ที่อ่านจากสตริงจริง (ไม่ได้ก๊อปตาราง) */
  const simulate = (sql: string) => {
    const map = new Map([...sql.matchAll(/when '([A-Z]+)' then '([A-Z]+)'/g)].map((m) => [m[1], m[2]]));
    return (v: string | null) => {
      const u = String(v ?? '').trim().toUpperCase();
      return map.get(u) ?? (u || null);
    };
  };

  it('แปลงทุกคู่ในตารางกลาง + รหัสแผนกคงเดิม + ว่าง = NULL — ผลตรง normalizeTrendBu ทุกค่า', () => {
    const run = simulate(trendBuSql('x'));
    const samples = [...Object.keys(SITE_BU_TO_DEPT), ...Object.values(SITE_BU_TO_DEPT), ' lml ', 'dsl', 'OPL', 'XYZ', '', null];
    for (const v of samples) expect(run(v), String(v)).toBe(normalizeTrendBu(v));
    expect(trendBuSql('x')).toContain("else nullif(upper(btrim(x)), '') end");
  });

  it('จากรหัสไซต์ = ประกอบ siteBuSql + trendBuSql · ผลตรง trendBuFromSiteCode', () => {
    expect(trendBuOfSiteSql('m.site_code')).toBe(trendBuSql(siteBuSql('m.site_code')));
    const run = simulate(trendBuSql('x'));
    const siteSql = (v: string) => (/^[0-9]{2}[A-Za-z]{3}/.test(v) ? v.slice(2, 5).toUpperCase() : null);
    for (const v of ['65LBDL0143', '66LML0011', '67dsl0003', '69SNJ0002', '68CRS0001', 'LBD', '']) {
      expect(run(siteSql(v)), v).toBe(trendBuFromSiteCode(v));
    }
  });
});
