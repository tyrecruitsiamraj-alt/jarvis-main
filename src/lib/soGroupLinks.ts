import { addPostingLink, searchRecruitChannels } from '@/lib/recruitPostingsApi';
import { recruitChannelLabel, type RecruitPosting, type RecruitPostingLink } from '@/lib/recruitPostings';
import {
  isFacebookGroupChannel,
  SO_LINK_NOTE,
  soGroupLinkKey,
  soGroupLinkLabel,
  soGroupLinkName,
  soGroupLinkOf,
  type SoLinkSource,
  type SoOptGroup,
} from '@/lib/soScraping';

/**
 * ═══ ลิงก์สมัครกลุ่มละลิงก์ — ตัวเดียวของ Autopost และโพสต์เอง (เจ้าของ 2 พ.ย. 2569 · 9 พ.ย. 2569) ═══
 * ชื่อลิงก์ "Facebook · Facebook Group · <ชื่อกลุ่ม>" · มีลิงก์ของทางนี้ (`source`) แล้วใช้ตัวเดิม ไม่มีค่อยสร้าง (สั่งซ้ำไม่งอกลิงก์)
 * จด `note` = ทางที่สร้าง ⇒ ผู้สมัครบอกได้ว่ามาจาก Autopost หรือโพสต์เอง
 */
export async function ensureSoGroupLinks(
  posting: RecruitPosting,
  picked: readonly SoOptGroup[],
  allGroups: readonly SoOptGroup[],
  source: SoLinkSource,
): Promise<{ links: Array<{ group: SoOptGroup; link: RecruitPostingLink }>; made: RecruitPostingLink[] }> {
  const matches = await searchRecruitChannels('Facebook Group', { limit: 20 });
  const fbGroup = matches.find((c) => isFacebookGroupChannel(c.name) && /^facebook$/i.test((c.parentName ?? '').trim())) ?? null;
  const channelLabel = fbGroup ? recruitChannelLabel(fbGroup) : 'Facebook · Facebook Group';
  const have: RecruitPostingLink[] = [...posting.links];
  const made: RecruitPostingLink[] = [];
  const links: Array<{ group: SoOptGroup; link: RecruitPostingLink }> = [];
  for (const g of picked) {
    const label = soGroupLinkLabel(channelLabel, soGroupLinkName(g, allGroups));
    let l = soGroupLinkOf(have, g, label, source);
    if (!l) {
      l = await addPostingLink(posting.id, { channelId: fbGroup?.id ?? null, channelLabel: label, fbGroupId: soGroupLinkKey(g), note: SO_LINK_NOTE[source] });
      made.push(l);
      have.push(l);
    }
    links.push({ group: g, link: l });
  }
  return { links, made };
}
