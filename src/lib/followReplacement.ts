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
