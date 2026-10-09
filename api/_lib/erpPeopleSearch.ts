/**
 * ═══ ค้นชื่อคนจาก ERP สำหรับฟอร์มเพิ่มคนหน้าติดตาม (เจ้าของ 9 ต.ค. 2569) ═══
 *
 * > *"ดึงชื่อพนักงานจาก บอร์ด เอาเป็นจาก Erp แทนได้ไหม รายชื่อเก่าๆมันไม่มาอะตอนนี้"*
 *
 * แหล่ง = `hr_recruitment` (ทะเบียนผู้สมัคร/พนักงานของ ERP · 137k แถว · มีเบอร์มือถือ 100k)
 * 🔴 ไม่ใช่ `hr_staff` — ตารางพนักงานมีเบอร์แค่ 1,159 จาก 73,219 คน (วัด 9 ต.ค. 2569) เลือกมาก็โทรไม่ได้
 * ค้นฝั่ง server (พิมพ์อย่างน้อย 2 ตัว · คืนไม่เกิน 30 คน · คนเดียวสมัครหลายรอบเอาแถวล่าสุด)
 * 🔴 ไม่ส่งเลขบัตรประชาชนออกไป — ใช้แค่จัดกลุ่มในคิวรี
 */
import { siamrajSqlQuery } from './siamrajSqlServer.js';

export type ErpPerson = {
  key: string;
  prefix: string | null;
  first_name: string;
  last_name: string | null;
  nick_name: string | null;
  sex_code: string | null;
  mobile: string;
  /** วันแจ้งเข้า (ได้งาน) ล่าสุด */
  inform_date: string | null;
  application_date: string | null;
  site_name: string | null;
};

export const ERP_PEOPLE_LIMIT = 30;

/** แยกคำค้น: ตัวเลขล้วน = เบอร์ · อื่น ๆ = ชื่อ/นามสกุล/ชื่อเล่น · ไม่เกิน 3 คำ */
export function erpPeopleTokens(q: string): Array<{ kind: 'phone' | 'name'; value: string }> {
  return q
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[%_[\]]/g, '').trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((t) => {
      const digits = t.replace(/\D/g, '');
      return /^[\d-]+$/.test(t) && digits.length >= 3 ? { kind: 'phone' as const, value: digits } : { kind: 'name' as const, value: t };
    });
}

export function erpPeopleSearchSql(tokens: ReturnType<typeof erpPeopleTokens>): { sql: string; params: Record<string, string> } {
  const params: Record<string, string> = {};
  const conds = tokens.map((t, i) => {
    params[`t${i}`] = `%${t.value}%`;
    return t.kind === 'phone'
      ? `REPLACE(REPLACE(r.mobile, '-', ''), ' ', '') LIKE @t${i}`
      : `(r.fname LIKE @t${i} OR r.lname LIKE @t${i} OR r.nick_name LIKE @t${i})`;
  });
  const sql = `
    WITH m AS (
      SELECT CAST(r.application_no AS varchar(40)) AS app_no,
             RTRIM(r.pfix_code) AS pfix_code, RTRIM(r.fname) AS fname, RTRIM(r.lname) AS lname,
             RTRIM(r.nick_name) AS nick_name, RTRIM(r.sex_code) AS sex_code,
             REPLACE(REPLACE(RTRIM(r.mobile), '-', ''), ' ', '') AS mobile,
             r.inform_date, r.application_date, RTRIM(r.site_name) AS site_name,
             ROW_NUMBER() OVER (
               PARTITION BY ISNULL(NULLIF(RTRIM(r.citizen_id), ''), CAST(r.application_no AS varchar(40)))
               ORDER BY COALESCE(r.inform_date, r.application_date) DESC
             ) AS rn
        FROM hr_recruitment r
       WHERE LEN(LTRIM(RTRIM(ISNULL(r.mobile, '')))) >= 9
         AND ${conds.join(' AND ')}
    )
    SELECT TOP ${ERP_PEOPLE_LIMIT} m.app_no, m.fname, m.lname, m.nick_name, m.sex_code, m.mobile,
           m.inform_date, m.application_date, m.site_name,
           (SELECT TOP 1 RTRIM(p.pfix_name) FROM ms_pfix p WHERE RTRIM(p.pfix_code) = m.pfix_code) AS pfix_name
      FROM m
     WHERE m.rn = 1
     ORDER BY COALESCE(m.inform_date, m.application_date) DESC`;
  return { sql, params };
}

const iso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

export async function searchErpPeople(q: string): Promise<ErpPerson[]> {
  if (q.replace(/\s/g, '').length < 2) return [];
  const tokens = erpPeopleTokens(q);
  if (tokens.length === 0) return [];
  const { sql, params } = erpPeopleSearchSql(tokens);
  const rows = await siamrajSqlQuery<Record<string, unknown>>(sql, params);
  return rows
    .map((r) => ({
      key: String(r.app_no ?? ''),
      prefix: clean(r.pfix_name),
      first_name: clean(r.fname) ?? '',
      last_name: clean(r.lname),
      nick_name: clean(r.nick_name),
      sex_code: clean(r.sex_code),
      mobile: clean(r.mobile) ?? '',
      inform_date: iso(r.inform_date),
      application_date: iso(r.application_date),
      site_name: clean(r.site_name),
    }))
    .filter((p) => p.first_name && p.mobile);
}
