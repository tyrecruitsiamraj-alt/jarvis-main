// @vitest-environment node
/**
 * ═══ ค้นชื่อจาก ERP ในฟอร์มเพิ่มคนหน้าติดตาม (เจ้าของ 9 ต.ค. 2569 "ดึงชื่อพนักงานจาก บอร์ด เอาเป็นจาก Erp แทน") ═══
 * 🔴 ด่าน: แหล่ง = hr_recruitment (hr_staff มีเบอร์แค่ 1,159/73,219) · เฉพาะคนที่มีเบอร์ · ไม่ส่งเลขบัตรออก ·
 *    คำค้นเป็นพารามิเตอร์ (ไม่ต่อสตริง) · ตัวเลขล้วน = ค้นเบอร์ · พิมพ์ไม่ถึง 2 ตัว = ไม่ยิง ERP
 */
import { describe, expect, it, vi } from 'vitest';

const siamrajSqlQuery = vi.fn();
vi.mock('../../api/_lib/siamrajSqlServer.js', () => ({ siamrajSqlQuery: (...a: unknown[]) => siamrajSqlQuery(...a) }));

const { erpPeopleTokens, erpPeopleSearchSql, searchErpPeople } = await import('../../api/_lib/erpPeopleSearch.js');
const { splitErpName } = await import('../../src/lib/erpPeopleApi.js');

describe('erpPeopleSearch', () => {
  it('แยกคำค้น: ชื่อ + เบอร์ · ตัดอักขระ LIKE ทิ้ง · ไม่เกิน 3 คำ', () => {
    expect(erpPeopleTokens(' ณัฐพล  086-617 ')).toEqual([
      { kind: 'name', value: 'ณัฐพล' },
      { kind: 'phone', value: '086617' },
    ]);
    expect(erpPeopleTokens('a% b_ c d').map((t) => t.value)).toEqual(['a', 'b', 'c']);
  });

  it('🔴 SQL: hr_recruitment · ต้องมีเบอร์ · คำค้นเป็นพารามิเตอร์ · ไม่เลือกเลขบัตรออกมา', () => {
    const { sql, params } = erpPeopleSearchSql(erpPeopleTokens("ณัฐพล' OR 1=1"));
    expect(sql).toMatch(/FROM hr_recruitment r/);
    expect(sql).toMatch(/LEN\(LTRIM\(RTRIM\(ISNULL\(r\.mobile, ''\)\)\)\) >= 9/);
    expect(sql).not.toMatch(/ณัฐพล/);
    expect(Object.values(params)).toContain("%ณัฐพล'%");
    const selected = sql.slice(sql.lastIndexOf('SELECT TOP'));
    expect(selected).not.toMatch(/citizen_id/);
  });

  it('พิมพ์ไม่ถึง 2 ตัว ⇒ ไม่ยิง ERP', async () => {
    siamrajSqlQuery.mockReset();
    expect(await searchErpPeople('ก')).toEqual([]);
    expect(siamrajSqlQuery).not.toHaveBeenCalled();
  });

  it('แปลงแถว ERP → คนที่เลือกได้ (ตัดแถวไม่มีชื่อ/เบอร์)', async () => {
    siamrajSqlQuery.mockResolvedValue([
      { app_no: 1, pfix_name: 'นาย', fname: 'ณัฐพล ', lname: 'สิงหัษฐิต', nick_name: null, sex_code: 'M', mobile: '0866174698', inform_date: new Date('2026-10-01'), application_date: null, site_name: 'รพ.' },
      { app_no: 2, pfix_name: null, fname: '', lname: 'x', mobile: '0800000000' },
    ]);
    const out = await searchErpPeople('ณัฐพล');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: '1', first_name: 'ณัฐพล', mobile: '0866174698', site_name: 'รพ.' });
  });

  it('คำนำหน้า: นาย/นาง/นางสาว ใช้ตามที่ ERP เก็บ · อื่น ๆ เดาจากเพศ', () => {
    const base = { key: 'k', first_name: 'ก', last_name: 'ข', nick_name: null, mobile: '08', inform_date: null, application_date: null, site_name: null };
    expect(splitErpName({ ...base, prefix: 'นาง', sex_code: 'F' }).prefix).toBe('นาง');
    expect(splitErpName({ ...base, prefix: 'ว่าที่ ร.ต.', sex_code: 'M' }).prefix).toBe('นาย');
    expect(splitErpName({ ...base, prefix: null, sex_code: null }).prefix).toBe('');
  });
});
