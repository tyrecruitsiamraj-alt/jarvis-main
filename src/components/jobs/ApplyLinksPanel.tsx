import React from 'react';
import { ChevronDown, Link2 } from 'lucide-react';
import GenApplyLinkDialog from '@/components/jobs/GenApplyLinkDialog';
import PostingLinksList from '@/components/jobs/PostingLinksList';
import AddChannelLinks from '@/components/jobs/AddChannelLinks';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { jobBuOf } from '@/lib/soScraping';
import { jobUnitSectorOf } from '@/lib/unitRequestDisplay';
import type { RecruitPosting } from '@/lib/recruitPostings';
import { fetchRecruitPostings } from '@/lib/recruitPostingsApi';
import type { JobRequest } from '@/types';

const NUM = new Intl.NumberFormat('th-TH');

/**
 * ═══ ลิงก์สมัครของใบขอ: "มีแล้ว N ลิงก์" + ปุ่ม Gen link (ตัวเดียวทุกหน้า) ═══
 * ย้ายมาจากหน้าไล่งานของใบ (BoardPostingPage) เมื่อเจ้าของ 4 พ.ย. 2569 ถาม "gen link ตรงนี้ไม่ได้หรอ"
 * ที่หน้ารายละเอียดใบขอ → Choice "ก็แบบหน้างานสรรหาไง" ⇒ สองหน้าใช้ชิ้นนี้ชิ้นเดียว
 * - "มีแล้ว N ลิงก์" กดแล้วกางดูทีละลิงก์ (เจ้าของ 4 ต.ค. 2569 → Choice "ครบ")
 * - 🔴 "Gen link" เป็นปุ่มกางลง (เจ้าของ 5 ต.ค. 2569 "พอกดไปให้มันเป็น Dropdown ไม่ใช่ค้างโชว์ไว้")
 *   มีประกาศแล้ว = เลือกช่องทางอย่างเดียว ข้อความเดิม · ยังไม่มี = กรอกข้อความประกาศครั้งแรกครั้งเดียว
 */
export default function ApplyLinksPanel({
  job,
  postings,
  failed,
  onReload,
  wantLink,
  onWantLinkChange,
}: {
  job: JobRequest | null;
  /** ประกาศทั้งหมดของใบนี้ (ใหม่ → เก่า) · null = กำลังโหลด */
  postings: RecruitPosting[] | null;
  /** อ่านประกาศไม่ได้ — บอกตรง ๆ และปิด Gen link */
  failed: boolean;
  onReload: () => void;
  /** ฟอร์ม Gen link กางอยู่ไหม — ส่งมาเมื่อหน้าต้องคุมเอง (หน้าไล่งานกางรอให้ใบที่ยังไม่มีลิงก์) */
  wantLink?: boolean;
  onWantLinkChange?: (open: boolean) => void;
}) {
  const [linksOpen, setLinksOpen] = React.useState(false);
  const [ownWantLink, setOwnWantLink] = React.useState(false);
  const want = wantLink ?? ownWantLink;
  const setWant = onWantLinkChange ?? setOwnWantLink;

  const open = (postings ?? []).filter((p) => p.status === 'open');
  /** ประกาศที่ยังเปิดล่าสุด — สร้างลิงก์เพิ่มใต้ประกาศนี้ (ไม่สร้างประกาศใหม่ซ้ำ) */
  const openPosting = open[0] ?? null;
  const linkCount = postings ? open.reduce((sum, p) => sum + p.links.length, 0) : null;

  /** มีประกาศเปิด = Gen link เพิ่มใต้ประกาศเดิม · ยังไม่มี = ฟอร์มแรก (กรอกข้อความประกาศครั้งเดียว) · ยังโหลดไม่เสร็จ = ยังไม่โชว์ (กันสร้างประกาศซ้ำ) */
  const genLinkForm =
    postings === null || !job ? null : openPosting ? (
      <AddChannelLinks
        posting={openPosting}
        jobBu={jobBuOf(job)}
        jobSector={jobUnitSectorOf(job)}
        onCreated={() => {
          onReload();
          setLinksOpen(false);
        }}
      />
    ) : (
      <GenApplyLinkDialog
        embedded
        open
        hidePreview
        channelOnly
        job={job}
        onClose={() => setWant(false)}
        onCreated={() => {
          onReload();
          setLinksOpen(true);
        }}
      />
    );

  return (
    <>
      {failed ? (
        <p className={cn('flex flex-wrap items-center gap-2 text-sm', TONE.danger.value)} data-testid="links-failed">
          อ่านลิงก์ไม่ได้
          <Button type="button" variant="outline" size="xs" onClick={onReload}>
            ลองใหม่
          </Button>
        </p>
      ) : linkCount === null ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : linkCount > 0 ? (
        <Collapsible open={linksOpen} onOpenChange={setLinksOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="-ml-2">
              มีแล้ว {NUM.format(linkCount)} ลิงก์
              {/* หลายชุดประกาศ = บอกจำนวนชุด (QA 17 ต.ค. 2569: หัว 4 ลิงก์ แต่ชุดที่เปิดดูบอก 3) */}
              {open.length > 1 ? ` · ${NUM.format(open.length)} ชุด` : ''}
              <ChevronDown className={cn('transition-transform', linksOpen && 'rotate-180')} aria-hidden />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <PostingLinksList postings={open} onChanged={onReload} />
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <p className="text-sm text-muted-foreground">ยังไม่มีลิงก์</p>
      )}
      <Collapsible open={want && !failed} onOpenChange={setWant}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" size="sm" data-testid="gen-link-toggle" disabled={failed}>
            <Link2 aria-hidden />
            {linkCount ? 'Gen link เพิ่ม' : 'Gen link'}
            <ChevronDown className={cn('transition-transform', want && 'rotate-180')} aria-hidden />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">{genLinkForm}</CollapsibleContent>
      </Collapsible>
    </>
  );
}

/** ลิงก์สมัครของใบหนึ่ง — โหลดประกาศของใบเอง แล้วใช้ ApplyLinksPanel (ช่อง "สั่งอะไร" › Gen link · 4 พ.ย. 2569) */
export function JobApplyLinks({ job, onChanged }: { job: JobRequest; onChanged?: () => void }) {
  const [postings, setPostings] = React.useState<RecruitPosting[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const load = React.useCallback(async () => {
    try {
      setPostings(await fetchRecruitPostings({ jobId: job.id }));
      setFailed(false);
    } catch {
      setPostings([]);
      setFailed(true);
    }
  }, [job.id]);
  React.useEffect(() => {
    void load();
  }, [load]);
  return (
    <ApplyLinksPanel
      job={job}
      postings={postings}
      failed={failed}
      onReload={() => {
        void load();
        onChanged?.();
      }}
    />
  );
}
