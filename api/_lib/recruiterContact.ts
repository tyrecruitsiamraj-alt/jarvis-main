/**
 * ═══ เบอร์เจ้าหน้าที่สรรหาบนการ์ดงาน (หน้าสมัครสาธารณะ + ตัวอย่างในป๊อปประกาศ · เจ้าของ 20 ต.ค. 2569 "โชว์เบอร์โทรเจ้าหน้าที่สรรหาด้วย") ═══
 * ใบขอเก็บชื่อเล่นเจ้าหน้าที่สรรหา (`recruiter_name`) · เบอร์ตัวจริงอยู่หน้าผู้ใช้งาน (users.nickname + phone · ที่เดียวกับ /api/job-staff)
 * 🔴 ชื่อเล่นซ้ำแล้วเบอร์ต่างกัน = ไม่โชว์ (ห้ามเดาเบอร์ผิดคนให้คนนอก) · ไม่มีเบอร์ = ไม่โชว์บรรทัด
 * อ่านไม่ได้ = Map ว่าง (การ์ดยังขึ้นครบ แค่ไม่มีบรรทัดติดต่อ)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { toE164Thai } from './thaiPhone.js';
import { isPlaceholderPhone } from '../../src/lib/followPhoneGuard.js';
import { logWarn, errorSummaryText } from './logger.js';

export type RecruiterContact = { name: string; phone: string };

const norm = (s: string) => s.trim().toLowerCase();

/** E.164 → 0XX-XXX-XXXX */
export function displayThaiPhone(raw: string | null | undefined): string | null {
  const e164 = toE164Thai(raw ?? '');
  if (!e164 || isPlaceholderPhone(e164)) return null;
  const local = `0${e164.slice(3)}`;
  return local.length === 10 ? `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}` : local;
}

/** เลือกเบอร์จากแถวของชื่อเล่นเดียวกัน — เบอร์เดียว = ใช้ · หลายเบอร์ = null */
export function pickRecruiterContact(rows: ReadonlyArray<{ name: string; phone: string | null }>): RecruiterContact | null {
  const phones = new Set<string>();
  let name = '';
  for (const r of rows) {
    const p = displayThaiPhone(r.phone);
    if (!p) continue;
    phones.add(p);
    name = r.name.trim();
  }
  return phones.size === 1 ? { name, phone: [...phones][0] } : null;
}

export async function loadRecruiterContacts(names: ReadonlyArray<string | null | undefined>): Promise<Map<string, RecruiterContact>> {
  const out = new Map<string, RecruiterContact>();
  const keys = [...new Set(names.map((n) => norm(n ?? '')).filter(Boolean))];
  if (keys.length === 0) return out;
  try {
    const { rows } = await dbQuery<{ k: string; name: string; phone: string | null }>(
      `select lower(trim(nickname)) as k, trim(nickname) as name, phone
         from ${tableInAppSchema('users')}
        where is_active and lower(trim(nickname)) = any($1::text[])
          and coalesce(trim(phone), '') <> ''`,
      [keys],
    );
    const byKey = new Map<string, Array<{ name: string; phone: string | null }>>();
    for (const r of rows) byKey.set(r.k, [...(byKey.get(r.k) ?? []), r]);
    for (const [k, list] of byKey) {
      const c = pickRecruiterContact(list);
      if (c) out.set(k, c);
    }
  } catch (e) {
    logWarn('recruiterContact: อ่านเบอร์เจ้าหน้าที่ไม่สำเร็จ', { error: errorSummaryText(e) });
  }
  return out;
}

export function recruiterContactOf(map: ReadonlyMap<string, RecruiterContact>, name: string | null | undefined): RecruiterContact | null {
  const k = norm(name ?? '');
  return k ? (map.get(k) ?? null) : null;
}
