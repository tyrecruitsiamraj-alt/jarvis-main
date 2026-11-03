import React from 'react';
import { copyText } from '@/lib/copyText';
import { Check, Copy, Link2, Loader2 } from 'lucide-react';
import MultiChannelPicker from '@/components/shared/MultiChannelPicker';
import SoGroupPicker from '@/components/jobs/SoGroupPicker';
import { fetchSoGroups } from '@/lib/jobPostingRequestsApi';
import { isFacebookGroupChannel, soGroupLinkLabel, type SoGroup } from '@/lib/soScraping';
import { Button } from '@/components/ui/button';
import { addPostingLink } from '@/lib/recruitPostingsApi';
import {
  applyLinkPath,
  recruitChannelLabel,
  type RecruitChannelMatch,
  type RecruitPosting,
  type RecruitPostingLink,
} from '@/lib/recruitPostings';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { friendlyErrorText } from '@/lib/friendlyError';

const origin = () => (typeof window !== 'undefined' ? window.location.origin : '');

function useCopy() {
  const [copied, setCopied] = React.useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await copyText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* คัดลอกไม่ได้ — ลิงก์ยังเลือกคัดลอกเองได้ */
    }
  };
  return { copied, copy };
}

/**
 * ═══ สร้างลิงก์เพิ่มให้ประกาศเดิม — เลือกช่องทางอย่างเดียว (เจ้าของ 4 ต.ค. 2569) ═══
 * *"Gen link งาน ก ตอน gen ใส่ไป แล้วเด้งมาเลยว่า Link ทั้งหมดที่เจน แยกให้ Copy ได้เลย · อนาคตจะ Gen ใหม่
 * ไม่ต้องมานั่งใส่ข้อมูลใหม่ ให้มันจำ แค่อยากเปลี่ยนช่องทาง"* · *"งานนึงสร้างร้อยพันลิงก์ก็ได้
 * แต่กล่องบนประกาศต้องมีแค่กล่องงานนั้นงานเดียว"*
 *
 * - ใช้ข้อความประกาศเดิม (หัวข้อ/รายละเอียด) — เพิ่มลิงก์ใต้ประกาศเดียวกัน ไม่สร้างประกาศใหม่ซ้ำ
 * - ลิงก์ละช่องทาง (ผู้สมัครมาทางไหนนับแยกได้) · ไม่เลือกช่องทาง = ลิงก์กลาง 1 อัน
 * - สร้างเสร็จโชว์ลิงก์ใหม่ทั้งหมดทันที กดคัดลอกทีละอันหรือทั้งหมด (ห้ามซ้อน Dialog — กางในที่เดิม)
 * - ช่องทาง Facebook Group = เลือกกลุ่มจากรายชื่อ So Scraping · กลุ่มละ 1 ลิงก์ (3 พ.ย. 2569 · แบบเดียวกับ GenApplyLinkDialog)
 *   ใบที่มีลิงก์แล้วกด "Gen link เพิ่ม" มาที่นี่ — เดิมเลือกกลุ่มไม่ได้ ได้ลิงก์ Facebook Group ก้อนเดียว
 */
const AddChannelLinks: React.FC<{
  posting: RecruitPosting;
  /** ธุรกิจของใบขอ (LBD/LBA/…) — กลุ่ม Facebook ของธุรกิจนี้ขึ้นก่อน */
  jobBu?: string | null;
  onCreated?: () => void;
}> = ({ posting, jobBu = null, onCreated }) => {
  const [picked, setPicked] = React.useState<RecruitChannelMatch[]>([]);
  const [soGroups, setSoGroups] = React.useState<SoGroup[] | null>(null);
  const [groupPick, setGroupPick] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<RecruitPostingLink[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const { copied, copy } = useCopy();
  const resultRef = React.useRef<HTMLDivElement | null>(null);

  const fbGroupChannels = picked.filter((c) => isFacebookGroupChannel(c.name));
  const needGroups = fbGroupChannels.length > 0 && soGroups === null;
  React.useEffect(() => {
    if (!needGroups) return;
    let alive = true;
    fetchSoGroups()
      .then((g) => alive && setSoGroups(g))
      .catch((e: unknown) => {
        if (!alive) return;
        setSoGroups([]);
        setError(friendlyErrorText(e, 'โหลดกลุ่ม Facebook ไม่ได้'));
      });
    return () => {
      alive = false;
    };
  }, [needGroups]);

  /**
   * ช่องทาง → ลิงก์ที่จะสร้าง · Facebook Group เลือกกลุ่ม = กลุ่มละลิงก์ · ไม่เลือกกลุ่ม = 1 ลิงก์ของช่องทาง
   * (เจ้าของ 3 พ.ย. 2569 "ไม่เลือกกลุ่มก็ gen ได้") · ไม่เลือกช่องทาง = ลิงก์กลาง 1 อัน
   */
  const pickedGroups = (soGroups ?? []).filter((g) => groupPick.includes(g.id));
  const wanted: ({ channelId: string; channelLabel: string } | null)[] =
    picked.length === 0
      ? [null]
      : picked.flatMap((c) =>
          isFacebookGroupChannel(c.name) && pickedGroups.length > 0
            ? pickedGroups.map((g) => ({ channelId: c.id, channelLabel: soGroupLinkLabel(recruitChannelLabel(c), g.name) }))
            : [{ channelId: c.id, channelLabel: recruitChannelLabel(c) }],
        );

  const create = async () => {
    setBusy(true);
    setError(null);
    const made: RecruitPostingLink[] = [];
    try {
      for (const c of wanted) {
        const link = await addPostingLink(posting.id, c ?? {});
        // ไม่มีรหัส = ลิงก์เสีย (/apply/p/undefined) ห้ามโชว์ให้คัดลอก (QA 5 ต.ค. 2569)
        if (!link?.code) throw new Error('Gen link ไม่สำเร็จ');
        made.push(link);
      }
    } catch (e) {
      setError(
        `${friendlyErrorText(e, 'Gen link ไม่สำเร็จ')}${made.length > 0 ? ` (Gen แล้ว ${made.length} ลิงก์)` : ''}`,
      );
    } finally {
      setBusy(false);
      if (made.length > 0) {
        setDone(made);
        setPicked([]);
        setGroupPick([]);
        onCreated?.();
        window.setTimeout(() => resultRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 50);
      }
    }
  };

  const urlOf = (l: RecruitPostingLink) => `${origin()}${applyLinkPath(l.code)}`;
  const labelOf = (l: RecruitPostingLink) => l.channelLabel?.trim() || 'ลิงก์กลาง (ไม่ระบุช่องทาง)';
  const allText = done.map((l) => `${labelOf(l)}\n${urlOf(l)}`).join('\n\n');

  return (
    <div className="space-y-3" data-testid="add-channel-links">
      <p className="text-xs text-muted-foreground">
        ข้อความประกาศ <span className="text-foreground">{posting.title}</span>
      </p>
      <MultiChannelPicker value={picked} onChange={setPicked} reloadKey={posting.id} />
      {fbGroupChannels.length > 0 ? (
        <div className="space-y-1.5" data-testid="add-links-groups">
          <p className="text-xs font-medium text-foreground">กลุ่ม Facebook · กลุ่มละ 1 ลิงก์ · ไม่เลือกก็ได้</p>
          <SoGroupPicker groups={soGroups} jobBu={jobBu} value={groupPick} onChange={setGroupPick} />
        </div>
      ) : null}
      <Button type="button" className="w-full" disabled={busy} onClick={() => void create()}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Link2 aria-hidden />}
        {/* คำว่า "Gen link" ทั้งก้อน (เจ้าของสั่ง 5 ต.ค. 2569 "สร้างลิงก์ เปลี่ยนเป็น Gen link") */}
        {busy
          ? 'กำลัง Gen link…'
          : picked.length === 0
            ? 'Gen link กลาง 1 อัน'
            : wanted.length > 1
              ? `Gen ${wanted.length} ลิงก์`
              : 'Gen link'}
      </Button>
      {error ? <p className={cn('text-xs', TONE.danger.value)}>{error}</p> : null}

      {done.length > 0 ? (
        <div ref={resultRef} className={cn('space-y-2 rounded-xl border px-3 py-3', TONE.success.soft)} data-testid="new-links">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Gen แล้ว {done.length} ลิงก์</p>
            {done.length > 1 ? (
              <Button type="button" size="xs" variant="outline" onClick={() => void copy('all', allText)}>
                {copied === 'all' ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied === 'all' ? 'คัดลอกแล้ว' : 'คัดลอกทั้งหมด'}
              </Button>
            ) : null}
          </div>
          <ul className="divide-y divide-border/60">
            {done.map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{labelOf(l)}</p>
                  <p className="select-all break-all text-xs text-muted-foreground">{urlOf(l)}</p>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  aria-label={`คัดลอกลิงก์ ${labelOf(l)}`}
                  onClick={() => void copy(l.id, urlOf(l))}
                >
                  {copied === l.id ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied === l.id ? 'คัดลอกแล้ว' : 'คัดลอก'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default AddChannelLinks;
