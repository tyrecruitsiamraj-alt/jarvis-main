/**
 * ═══ ใครอยู่ในระบบ (เจ้าของสั่ง 30 ก.ย. 2569) ═══
 *
 * 🔴 ย้ายแล้ว: เดิมเป็นแผงท้ายหน้าหลัก → ตอนนี้อยู่ใน **ตั้งค่า › ผู้ใช้งาน** (เจ้าของ: *"ใครอยู่ในระบบ ย้ายไปหน้าอื่น
 *    หน้าตั้งค่าก็ได้ เรียงผู้ใช้งานใหม่ บอกเลยใคร online"* → Choice "รวมเข้าตารางผู้ใช้งาน") · ใต้ชื่อบอกสถานะ ·
 *    Online ขึ้นก่อน (`sortByPresence`) · ปุ่มกรองสถานะเหนือตาราง (`matchesPresence`)
 *
 * เจ้าของ: *"หน้านี้ด้านล่างเพิ่ม ใครกำลัง Online ใคร offline ใครยังไม่เข้าระบบ เข้าระบบล่าสุดวันไหน"*
 * → Choice **"ดูจากการใช้งานล่าสุด"** (ระบบไม่มีบันทึกการเปิดดู) · **หัวหน้ากับผู้ดูแลเห็นชื่อ** คนอื่นเห็นแค่ยอด
 *
 * - **Online** = เข้าระบบหรือบันทึกงานใน 30 นาทีล่าสุด (ร่องรอยชุดเดียวกับหน้าทีม Online · `userActivitySql.ts`)
 * - **Offline** = เคยเข้าระบบแล้ว แต่ 30 นาทีล่าสุดไม่มีร่องรอย
 * - **ยังไม่เข้าระบบ** = ไม่เคยเข้าระบบเลย (ประวัติเริ่มเก็บ 1 ก.ค. 2569)
 * - **เข้าระบบล่าสุด** = นับทุกทาง รหัสผ่าน · ลิงก์อีเมล · Microsoft (`authActions.ts`)
 * ⚠️ คนที่เปิดดูเฉย ๆ ไม่ได้กดอะไรจะขึ้น Offline — เจ้าของเลือกทางนี้เองโดยรู้ข้อนี้
 *
 * ไฟล์นี้ pure — เทสต์ที่ `tests/api/homePresence.test.ts`
 */
import type { ToneKey } from '@/lib/designTokens';
import { SITE_BU_TO_DEPT } from '@/lib/trends/bu';

export const ONLINE_MINUTES = 30;

export type PresenceStatus = 'online' | 'offline' | 'never';

export const PRESENCE_STATUSES: readonly PresenceStatus[] = ['online', 'offline', 'never'];

export const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  never: 'ยังไม่เข้าระบบ',
};

/** เขียว = อยู่ในระบบ · เทา = ไม่อยู่ · แดง = ยังไม่เคยเข้า (สีเดียวกับ "ยังไม่เคยเข้าระบบ" ของหน้าทีม Online) */
export const PRESENCE_TONE: Record<PresenceStatus, ToneKey> = {
  online: 'success',
  offline: 'neutral',
  never: 'danger',
};

export type PresencePerson = {
  id: string;
  name: string;
  /** BU ชุดแผนก (`normalizeTrendBu`) · '' = ไม่ระบุ */
  bu: string;
  role: string;
  status: PresenceStatus;
  lastLoginAt: string | null;
  /** ร่องรอยล่าสุดใน 30 นาทีที่ผ่านมา · null = ช่วงนั้นไม่มีร่องรอย */
  lastActiveAt: string | null;
};

export type PresenceCounts = { total: number; online: number; offline: number; never: number };

/** ยอดของ BU เดียว — `bu` = รหัสชุดแผนก · '' = ไม่ระบุ BU */
export type PresenceBuCount = { bu: string; counts: PresenceCounts };

export const PRESENCE_NO_BU_LABEL = 'ไม่ระบุ BU';

export type HomePresenceResponse = {
  generated_at: string;
  online_minutes: number;
  /** BU ที่ถูกล็อก (บัญชีผูกแผนก) · null = ทุก BU */
  bu: string | null;
  counts: PresenceCounts | null;
  /**
   * แยก BU (รอบ 5 · เจ้าของ: *"ใครอยู่ในระบบโอเคแล้ว แต่แยก BU ให้หน่อย กดแล้วแยก BU"*) — เฉพาะ BU ที่มีคน
   * ส่งให้ทุกคน (ยอดไม่ใช่ชื่อ) ⇒ คนที่เห็นแค่ยอดก็แยก BU ได้ · null = โหลดไม่ได้
   */
  by_bu: PresenceBuCount[] | null;
  /** null = ไม่มีสิทธิ์เห็นชื่อ (เห็นแค่ยอด) */
  people: PresencePerson[] | null;
  can_see_people: boolean;
  error: string | null;
};

const ms = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : NaN;
};

export function presenceStatus(
  p: { lastLoginAt: string | null; lastActiveAt: string | null },
  now: Date,
  minutes: number = ONLINE_MINUTES,
): PresenceStatus {
  const active = ms(p.lastActiveAt);
  if (Number.isFinite(active) && now.getTime() - active <= minutes * 60_000) return 'online';
  if (p.lastLoginAt || p.lastActiveAt) return 'offline';
  return 'never';
}

export type RawPresenceAccount = { id: string; name: string; bu: string; role: string; active: boolean };

/** บัญชีที่เปิดใช้อยู่ + เวลาเข้าระบบล่าสุด + ร่องรอยล่าสุด → รายชื่อพร้อมสถานะ (บัญชีที่ปิดแล้วไม่อยู่ในรายชื่อ) */
export function buildPresencePeople(
  accounts: readonly RawPresenceAccount[],
  lastLogin: ReadonlyMap<string, string>,
  recent: ReadonlyMap<string, string>,
  now: Date,
): PresencePerson[] {
  return accounts
    .filter((a) => a.active)
    .map((a) => {
      const lastLoginAt = lastLogin.get(a.id) ?? null;
      const lastActiveAt = recent.get(a.id) ?? null;
      return {
        id: a.id,
        name: a.name,
        bu: a.bu,
        role: a.role,
        lastLoginAt,
        lastActiveAt,
        status: presenceStatus({ lastLoginAt, lastActiveAt }, now),
      };
    });
}

const STATUS_ORDER: Record<PresenceStatus, number> = { online: 0, offline: 1, never: 2 };

/** Online ก่อน (ใช้ล่าสุดอยู่บน) → Offline (เข้าระบบล่าสุดอยู่บน) → ยังไม่เข้าระบบ (เรียงตาม BU แล้วชื่อ) */
export function sortPresence(people: readonly PresencePerson[]): PresencePerson[] {
  const latest = (p: PresencePerson) => {
    const t = p.status === 'online' ? ms(p.lastActiveAt) : ms(p.lastLoginAt);
    return Number.isFinite(t) ? t : 0;
  };
  return [...people].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      latest(b) - latest(a) ||
      (a.bu || '~').localeCompare(b.bu || '~') ||
      a.name.localeCompare(b.name, 'th'),
  );
}

/** ตัวกรองสถานะของตารางผู้ใช้งาน — ทั้งหมด หรือสถานะใดสถานะหนึ่ง */
export type PresenceFilter = 'all' | PresenceStatus;

/**
 * เรียงบัญชีในตารางผู้ใช้งานตามสถานะ — ลำดับเดียวกับ `sortPresence` (Online ใช้ล่าสุดก่อน → Offline เข้าล่าสุดก่อน →
 * ยังไม่เข้าระบบ) · บัญชีที่ไม่มีสถานะ (ปิดใช้งาน · นอก BU ที่เห็นได้) ไว้ท้ายสุดตามลำดับเดิม
 */
export function sortByPresence<T extends { id: string }>(items: readonly T[], people: readonly PresencePerson[]): T[] {
  const rank = new Map(sortPresence(people).map((p, i) => [p.id, i]));
  return items
    .map((item, i) => ({ item, i, r: rank.get(item.id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.item);
}

/** บัญชีนี้ผ่านตัวกรองไหม — "ทั้งหมด" ผ่านทุกบัญชี (รวมบัญชีที่ไม่มีสถานะ) */
export function matchesPresence(person: PresencePerson | undefined, filter: PresenceFilter): boolean {
  return filter === 'all' || person?.status === filter;
}

export function countPresence(people: readonly PresencePerson[]): PresenceCounts {
  const n = (s: PresenceStatus) => people.filter((p) => p.status === s).length;
  return { total: people.length, online: n('online'), offline: n('offline'), never: n('never') };
}

/** ลำดับ BU ตามชุดแผนกของบริษัท (LBD · LBA · LM · DS · SN · CR) — ชุดเดียวกับกราฟหน้าหลัก */
const BU_ORDER: readonly string[] = [...new Set(Object.values(SITE_BU_TO_DEPT))];

/**
 * เรียง BU: ชุดแผนก → BU อื่นตามตัวอักษร → '' (ไม่ระบุ BU) ท้ายสุด
 * ตัวเดียวทั้งระบบ — ยอดแยก BU ของสถานะ Online + ปุ่ม BU ของตั้งค่า › ผู้ใช้งาน (`userBuFilter`) ใช้ร่วมกัน
 */
export function compareBu(a: string, b: string): number {
  const rank = (bu: string) => (bu === '' ? Number.MAX_SAFE_INTEGER : BU_ORDER.includes(bu) ? BU_ORDER.indexOf(bu) : BU_ORDER.length);
  return rank(a) - rank(b) || a.localeCompare(b);
}

/**
 * ยอดแยก BU — เฉพาะ BU ที่มีคนจริง · เรียงตามชุดแผนก → BU อื่นตามตัวอักษร → ไม่ระบุ BU ท้ายสุด
 * รวมทุก BU = `countPresence` ของทั้งหมดเสมอ (ไม่มีคนหล่นหาย)
 */
export function countPresenceByBu(people: readonly PresencePerson[]): PresenceBuCount[] {
  const by = new Map<string, PresencePerson[]>();
  for (const p of people) {
    const k = p.bu || '';
    by.set(k, [...(by.get(k) ?? []), p]);
  }
  return [...by.keys()].sort(compareBu).map((bu) => ({ bu, counts: countPresence(by.get(bu) ?? []) }));
}

const TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const DAY = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
const BKK_YMD = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });
const NUM = new Intl.NumberFormat('th-TH');

const dayIndex = (ymd: string) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000);

/** "วันนี้ 09:12" · "เมื่อวาน 17:40" · "3 วันก่อน" · "12 ส.ค. 2569" · ไม่เคย = "ยังไม่เคย" */
export function lastLoginText(iso: string | null, now: Date): string {
  if (!iso) return 'ยังไม่เคย';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'ยังไม่เคย';
  const ago = dayIndex(BKK_YMD.format(now)) - dayIndex(BKK_YMD.format(d));
  if (ago <= 0) return `วันนี้ ${TIME.format(d)}`;
  if (ago === 1) return `เมื่อวาน ${TIME.format(d)}`;
  if (ago < 7) return `${NUM.format(ago)} วันก่อน`;
  return DAY.format(d);
}

/** ใช้งานล่าสุดของคนที่ Online — "เมื่อสักครู่" · "12 นาทีก่อน" */
export function activeAgoText(iso: string | null, now: Date): string | null {
  const t = ms(iso);
  if (!Number.isFinite(t)) return null;
  const m = Math.max(0, Math.round((now.getTime() - t) / 60_000));
  return m < 1 ? 'เมื่อสักครู่' : `${NUM.format(m)} นาทีก่อน`;
}
