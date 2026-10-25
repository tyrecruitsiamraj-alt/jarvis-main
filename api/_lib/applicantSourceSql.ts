/**
 * ═══ แจ้งเข้า ERP + ช่องทาง iRecruit ต่อเบอร์ (เจ้าของ 19 ต.ค. 2569 — ตาราง "ช่องทาง → แจ้งเข้า" หน้าภาพรวมงานสรรหา) ═══
 * อ่านอย่างเดียว · คืนแค่เบอร์ 9 ตัวท้าย → วัน/ช่องทาง ให้ `recruit-overview` จับคู่ทีละใบ (ไม่ส่งเบอร์ออกหน้าเว็บ)
 * แคช 10 นาทีต่อช่วง
 */
import { irecruitSqlQuery } from './irecruitSqlServer.js';
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { activeInformWhereSql } from './siamrajStaffingOpen.js';
import { mainChannelOf } from '../../src/lib/channelPlacement.js';

const CACHE_MS = 10 * 60_000;
const informCache = new Map<string, { at: number; value: Map<string, string[]> }>();
const regCache = new Map<string, { at: number; value: Map<string, { at: string; channel: string }[]> }>();

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v ?? ''));
const shiftYmd = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const K9 = (col: string) => `RIGHT(REPLACE(REPLACE(RTRIM(${col}), '-', ''), ' ', ''), 9)`;

/** วันแจ้งเข้า (YYYY-MM-DD) ต่อเบอร์ — ใบที่ไม่ยกเลิก ตั้งแต่ `from` */
export async function loadInformDaysByPhone(from: string): Promise<Map<string, string[]>> {
  const hit = informCache.get(from);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const rows = await siamrajSqlQuery<{ k: string; d: Date | string }>(
    `SELECT ${K9('r.mobile')} AS k, IH.inform_date AS d
       FROM hr_recruitment r
       INNER JOIN st_inform_head IH ON IH.inform_no = r.inform_no
      WHERE r.mobile IS NOT NULL AND ${activeInformWhereSql('IH')} AND IH.inform_date >= @from`,
    { from },
  );
  const value = new Map<string, string[]>();
  for (const r of rows) {
    const k = String(r.k ?? '').trim();
    if (!/^\d{9}$/.test(k)) continue;
    const list = value.get(k) ?? [];
    list.push(iso(r.d).slice(0, 10));
    value.set(k, list);
  }
  informCache.set(from, { at: Date.now(), value });
  return value;
}

/** การลงทะเบียนใน iRecruit ต่อเบอร์ (ช่องทางหลัก) — ย้อน 60 วันก่อนต้นช่วง */
export async function loadIrecruitRegsByPhone(from: string, to: string): Promise<Map<string, { at: string; channel: string; sub?: string | null }[]>> {
  const key = `${from}|${to}`;
  const hit = regCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const rows = await irecruitSqlQuery<{ k: string; at: Date | string; ch: string | null; sub: string | null }>(
    `SELECT ${K9('r.phone_number')} AS k, r.created_at AS at, c.name AS ch, s.name AS sub
       FROM recruit_register r
       LEFT JOIN recruit_master_sub_channel s ON s.id = r.channel_id
       LEFT JOIN recruit_master_channel c ON c.id = s.channel_id
      WHERE r.deleted_at IS NULL AND r.created_at >= @from AND r.created_at < @to`,
    { from: shiftYmd(from, -60), to: shiftYmd(to, 2) },
  );
  const value = new Map<string, { at: string; channel: string; sub?: string | null }[]>();
  for (const r of rows) {
    const k = String(r.k ?? '').trim();
    if (!/^\d{9}$/.test(k)) continue;
    const list = value.get(k) ?? [];
    // sub = ชื่อกลุ่ม/เพจย่อยของ iRecruit — กดช่องทางลงไปดูชื่อกลุ่ม (เจ้าของ 25 ต.ค. 2569)
    list.push({ at: iso(r.at), channel: mainChannelOf(r.ch, r.sub), sub: (r.sub ?? '').trim() || null });
    value.set(k, list);
  }
  regCache.set(key, { at: Date.now(), value });
  return value;
}

const irApplicantCache = new Map<string, { at: number; value: Map<string, string[]> }>();

/**
 * วันที่เป็นผู้สมัครใน iRecruit (`hr_recruitment.application_date`) ต่อเบอร์ — ตั้งแต่ `from` (20 ต.ค. 2569)
 * ขั้น "ผ่านแล้วคีย์เข้า iRecruit → ERP" ของเจ้าของ: คนที่มาตามนัดต้องไปโผล่ที่นี่ · จับด้วยเบอร์ 9 ตัวท้าย
 */
export async function loadIrecruitApplicantDays(from: string): Promise<Map<string, string[]>> {
  const hit = irApplicantCache.get(from);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const rows = await irecruitSqlQuery<{ k: string; d: Date | string }>(
    `SELECT ${K9('mobile')} AS k, application_date AS d FROM hr_recruitment WHERE mobile IS NOT NULL AND application_date >= @from`,
    { from },
  );
  const value = new Map<string, string[]>();
  for (const r of rows) {
    const k = String(r.k ?? '').trim();
    if (!/^\d{9}$/.test(k)) continue;
    const list = value.get(k) ?? [];
    list.push(iso(r.d).slice(0, 10));
    value.set(k, list);
  }
  irApplicantCache.set(from, { at: Date.now(), value });
  return value;
}
