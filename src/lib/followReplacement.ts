/**
 * ═══ แท็บ "ติดตามส่งคนแทน" ของหน้าการติดตาม (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * > *"ฉันอยากได้หน้า รายชื่อติดตามอีกอัน … มันคือ ติดตามคนที่จะไปแทนงาน เลยใช้ชื่อว่า ติดตามส่งคนแทน"*
 * > *"หน้า ติดตามส่งคนแทน ต้องทำเหมือน รายชื่อติดตามไง มันทำงานเหมือนกันแค่คนละทีม"* ·
 * > *"หน้า รายชื่อติดตาม และ ติดตามส่งคนแทน ต้องเหมือนกันนะ"*
 *
 * 🔴 สองแท็บ **หน้าตา/ฟอร์ม/เรื่อง/ปฏิทินชุดเดียวกันทุกอย่าง** — แยกกองด้วย **ทีม** (`follow_team` · migration 131)
 *    ไม่ใช่ด้วยเรื่อง (รอบแรกล็อกเรื่องเป็น "ติดตามส่งคนแทน" — เจ้าของบอกให้เหมือนกันทุกอย่าง จึงเลิกล็อก)
 * · null = ทีมติดตาม (แท็บรายชื่อติดตาม · ของเดิมทุกแถว) · `'replacement'` = ทีมส่งคนแทน
 * · กดเพิ่มจากแท็บไหน = ทีมของแท็บนั้น · รอบที่เพิ่มทีหลังในกล่องแก้ไขตามทีมของรายการเดิม
 * · หน้าหลัก "ระบบไปกี่ %" ก้อนติดตาม + แท็บ Dashboard ยังนับรวมทั้งสองทีม (เป็นงานติดตามเหมือนกัน)
 * ไฟล์นี้ไม่มี import — เส้น API ใช้ค่าคงที่ตัวเดียวกันได้
 */

/** ค่าทีมส่งคนแทนในช่อง `follow_team` — ตัวเดียวทั้งระบบ (เส้น + หน้าเว็บ) */
export const FOLLOW_TEAM_REPLACEMENT = 'replacement' as const;

export type FollowTeam = typeof FOLLOW_TEAM_REPLACEMENT;

/** รายการนี้เป็นของทีมส่งคนแทนไหม */
export function isReplacementFollow(entry: { follow_team?: string | null }): boolean {
  return entry.follow_team === FOLLOW_TEAM_REPLACEMENT;
}

export type FollowScope = 'main' | 'replacement';

/** รายการของแท็บนั้น — `main` = รายชื่อติดตาม (ทีมติดตาม) · `replacement` = ติดตามส่งคนแทน (ทีมส่งคนแทน) */
export function followScopeEntries<T extends { follow_team?: string | null }>(items: readonly T[], scope: FollowScope): T[] {
  const wantReplacement = scope === 'replacement';
  return items.filter((e) => isReplacementFollow(e) === wantReplacement);
}

/** ทีมที่ต้องส่งตอนกดเพิ่มจากแท็บนี้ — แท็บรายชื่อติดตามไม่ส่งคีย์ (พฤติกรรมเดิมทุกตัวอักษร) */
export function followTeamForScope(scope: FollowScope): FollowTeam | undefined {
  return scope === 'replacement' ? FOLLOW_TEAM_REPLACEMENT : undefined;
}

/**
 * ═══ แยกกลุ่มบนแท็บส่งคนแทน (เจ้าของสั่ง 6 ต.ค. 2569 "แยก Ex กับ คนใน เพิ่ม Filter มา") ═══
 * 🔴 8 ต.ค. 2569: แยกด้วยรายชื่อ WL ของ iRecruit แทนช่อง IN/EX (ค่าเก่าค้าง) — รอบดึงเก็บ 'WL' / 'EX' ลง `replace_type`
 * 'WL' = WL (คนโทร) · ค่าอื่น = ไม่ใช่ WL (AI โทร · แถวเก่า 'IN' ที่หลุดช่วงดึงก็นับเป็นไม่ใช่ WL) · ไม่มีค่า = ไม่ระบุ (คีย์เอง)
 * ⚠️ ชื่อคีย์ `ex` / `inner` คงไว้ (URL/ตัวกรองเดิม) — `inner` = WL
 */
export type ReplaceKind = 'ex' | 'inner' | 'unknown';
export type ReplaceKindFilter = 'all' | ReplaceKind;
export const REPLACE_KIND_FILTERS: readonly ReplaceKindFilter[] = ['all', 'ex', 'inner', 'unknown'];
export const REPLACE_KIND_LABEL: Record<ReplaceKindFilter, string> = {
  all: 'ทั้งหมด',
  ex: 'ไม่ใช่ WL',
  inner: 'WL',
  unknown: 'ไม่ระบุ',
};

export function replaceKindOf(entry: { replace_type?: string | null }): ReplaceKind {
  const t = (entry.replace_type ?? '').trim().toUpperCase();
  if (!t) return 'unknown';
  return t === 'WL' ? 'inner' : 'ex';
}

export function countReplaceKinds(items: readonly { replace_type?: string | null }[]): Record<ReplaceKindFilter, number> {
  const out: Record<ReplaceKindFilter, number> = { all: items.length, ex: 0, inner: 0, unknown: 0 };
  for (const e of items) out[replaceKindOf(e)] += 1;
  return out;
}
