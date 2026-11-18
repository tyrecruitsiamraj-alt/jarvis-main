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
