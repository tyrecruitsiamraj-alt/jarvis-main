/**
 * ═══ คำสั่ง Autopost → คำขอโพสต์ของ phone-box ทีละกลุ่ม (เจ้าของ 18 พ.ย. 2569) ═══
 * phone-box รับ `group_name` (ชื่อกลุ่ม) + `content` · ลิงก์สมัครแยกกลุ่มละอัน (`group_links` · 2 พ.ย. 2569)
 * ⇒ ข้อความของแต่ละกลุ่ม = caption ที่แทนลิงก์หลักด้วยลิงก์ของกลุ่มนั้น · กลุ่มที่หาชื่อไม่เจอ = ข้าม
 */
export type PhoneBoxPostDraft = { groupId: string; groupName: string; content: string };

type Snapshot = {
  caption?: unknown;
  apply_link?: unknown;
  group_ids?: unknown;
  group_links?: unknown;
};

export function phoneBoxPostsOf(snapshot: Snapshot | null | undefined, groups: readonly { id: string; name: string | null }[]): PhoneBoxPostDraft[] {
  const caption = typeof snapshot?.caption === 'string' ? snapshot.caption.trim() : '';
  if (!caption) return [];
  const mainLink = typeof snapshot?.apply_link === 'string' ? snapshot.apply_link : '';
  const ids = Array.isArray(snapshot?.group_ids) ? snapshot.group_ids.filter((x): x is string => typeof x === 'string') : [];
  const links = Array.isArray(snapshot?.group_links) ? (snapshot.group_links as Array<{ group_id?: unknown; apply_link?: unknown }>) : [];
  const out: PhoneBoxPostDraft[] = [];
  for (const id of ids) {
    const name = groups.find((g) => g.id === id)?.name?.trim();
    if (!name) continue;
    const own = links.find((l) => l.group_id === id)?.apply_link;
    const content = mainLink && typeof own === 'string' && own ? caption.split(mainLink).join(own) : caption;
    out.push({ groupId: id, groupName: name, content });
  }
  return out;
}

/**
 * คำบนจอของสถานะคำขอที่ phone-box — กติกาเจ้าของ 17 พ.ย. 2569: uncertain = "อนุมัติ" (โพสต์แล้วรอแอดมินกลุ่ม)
 * published true = ขึ้นกลุ่มแล้ว · ไม่รู้จัก = คำเดิมของ phone-box (ไม่เดา)
 */
export function phoneBoxStatusText(v: { status: string; published: boolean | null }): { text: string; tone: 'success' | 'warn' | 'danger' | 'neutral' } {
  if (v.published === true) return { text: 'ขึ้นกลุ่มแล้ว', tone: 'success' };
  switch (v.status) {
    case 'awaiting_executor':
      return { text: 'รอมือถือโพสต์', tone: 'warn' };
    case 'queued':
    case 'running':
    case 'in_progress':
      return { text: 'มือถือกำลังโพสต์', tone: 'warn' };
    case 'uncertain':
      return { text: 'รอแอดมินกลุ่มอนุมัติ', tone: 'warn' };
    case 'failed':
      return { text: 'ไม่สำเร็จ', tone: 'danger' };
    case 'cancelled':
      return { text: 'ยกเลิกแล้ว', tone: 'neutral' };
    case 'error':
      return { text: 'อ่านสถานะไม่ได้', tone: 'danger' };
    default:
      return { text: v.status, tone: 'neutral' };
  }
}

/* ═══ กลุ่มของบัญชีมือถือ (เจ้าของ 25 พ.ย. 2569 · Choice "เลือกได้เฉพาะกลุ่มของบัญชี") ═══
 * > "ดู jarvis ขาส่งงานมา phone box … มันส่งกลุ่มมาไม่ตรงเยอะเลย เหมือนมันไม่ใช่กลุ่มของ account นั้น"
 * ต้นเหตุ: ป๊อป Autopost ให้ทุกบัญชีเลือกได้ทุกกลุ่มของ So Scraping (2 พ.ย. 2569 — So Scraping กดเข้าร่วมให้เอง)
 * แต่มือถือโพสต์ได้เฉพาะกลุ่มที่บัญชีอยู่จริง ⇒ phone-box ตีกลับ "ถาวร: ไม่พบกลุ่มในรายชื่อของบัญชี" (OPL6910028 ตีกลับ 25/27)
 * ⇒ บัญชีที่ส่งผ่าน phone-box เหลือเฉพาะกลุ่มที่ชื่อตรงกับรายชื่อกลุ่มของบัญชีนั้นที่ phone-box (GET /v1/accounts/{id}/groups)
 * อ่านไม่ได้ = ไม่มีกลุ่มให้เลือก (ไม่ส่งมั่ว) · ป๊อปกับ server ใช้ `soGroupsOfAccount` ตัวเดียวกัน
 */

/** ชื่อกลุ่มเทียบกันได้ — ตัดช่องว่างล่องหน/ช่องว่างซ้ำ ตัวพิมพ์เล็ก */
export function phoneBoxGroupKey(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** ชื่อกลุ่มจากคำตอบของ phone-box · ไม่มีรายการ / มีรายการแต่อ่านชื่อไม่ได้เลย = null (ถือว่าอ่านไม่ได้) */
export function phoneBoxGroupNamesOf(body: unknown): string[] | null {
  const list = (body as { groups?: unknown } | null)?.groups;
  if (!Array.isArray(list)) return null;
  const pick = (g: Record<string, unknown>) =>
    [g.name, g.group_name, g.title, g.display_name].find((v): v is string => typeof v === 'string' && v.trim() !== '') ?? null;
  const names = list.map((g) => (g && typeof g === 'object' ? pick(g as Record<string, unknown>) : null)).filter((v): v is string => Boolean(v));
  return list.length > 0 && names.length === 0 ? null : names;
}

type AccountGroups = { id: string; groupIds: string[]; warning: string | null };
type GroupOwners = { id: string; name: string | null; accountIds: string[] };

/**
 * จำกัดกลุ่มของบัญชีมือถือ — `groupIds` = กลุ่มของ So Scraping ที่ชื่อตรงกับรายชื่อของบัญชีที่ phone-box · ถอดบัญชีออกจาก `accountIds` ของกลุ่มอื่น
 * `names` null = อ่านไม่ได้ ⇒ ไม่มีกลุ่ม + คำเตือน
 */
export function limitToPhoneBoxGroups<A extends AccountGroups, G extends GroupOwners>(
  acc: A,
  groups: readonly G[],
  names: readonly string[] | null,
): { account: A; groups: G[]; matched: number } {
  const keys = new Set((names ?? []).map(phoneBoxGroupKey));
  const mine = new Set(groups.filter((g) => keys.has(phoneBoxGroupKey(g.name))).map((g) => g.id));
  return {
    account: {
      ...acc,
      groupIds: [...mine],
      warning: names === null ? 'อ่านรายชื่อกลุ่มของบัญชีมือถือไม่ได้ — ลองเปิดป๊อปใหม่' : acc.warning,
    },
    groups: groups.map((g) => (mine.has(g.id) || !g.accountIds.includes(acc.id) ? g : { ...g, accountIds: g.accountIds.filter((x) => x !== acc.id) })),
    matched: mine.size,
  };
}
