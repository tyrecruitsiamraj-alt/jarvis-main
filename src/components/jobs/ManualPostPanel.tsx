import React from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { useRecruiterContact } from '@/hooks/useRecruiterContact';
import { jobUnitSectorOf } from '@/lib/unitRequestDisplay';
import { fetchSoOptions } from '@/lib/jobPostingRequestsApi';
import { addPostingLink, createRecruitPosting, fetchRecruitPostings } from '@/lib/recruitPostingsApi';
import { jobPostingBody } from '@/lib/recruitPostingDraft';
import { releaseJobsToPublic } from '@/lib/jobPublicReleaseApi';
import { applyLinkPath, recruitChannelLabel, type RecruitChannelMatch, type RecruitPosting, type RecruitPostingLink } from '@/lib/recruitPostings';
import { AUTOPOST_LINK_PLACEHOLDER } from '@/lib/postText';
import { AUTOPOST_CAPTION_MAX, buildAutopostCaption } from '@/lib/autopostCaption';
import { saveUnitFieldOverridesPatch, unitRequestNoteKey } from '@/lib/siamrajUnitRequestsApi';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ensureSoGroupLinks } from '@/lib/soGroupLinks';
import { isFacebookGroupChannel, jobBuOf, SO_LINK_NOTE, soGroupLinkName, type SoOptGroup } from '@/lib/soScraping';
import SoGroupPicker from '@/components/jobs/SoGroupPicker';
import MultiChannelPicker from '@/components/shared/MultiChannelPicker';
import { syncCaptionLink } from '@/components/jobs/AutopostDialog';
import { copyText } from '@/lib/copyText';

/** แถวที่เตรียมแล้ว — ลิงก์ละแถว · กลุ่ม Facebook มี `group` (ปุ่มเปิดกลุ่ม) · ช่องทางอื่นไม่มี */
type Row = { key: string; name: string; group: SoOptGroup | null; link: RecruitPostingLink };

/**
 * 🔴 13 พ.ย. 2569 เจ้าของ "ทำเหมือนตอน gen link ไปเลย ถ้าเลือก facebook ก็ขึ้นช่องทางรองมาด้วย แล้วถ้าเลือก facebook Group
 * ก็ค่อยมีกลุ่มมาให้เลือก" — เลือกช่องทางหลัก → รอง (ตัวเดียวกับ Gen link · `MultiChannelPicker`) · มี Facebook Group = ค่อยเลือกกลุ่ม
 * ช่องทางอื่นได้ลิงก์ช่องละ 1 อัน (จด note = โพสต์เอง เหมือนลิงก์กลุ่ม)
 *
 * ═══ โพสต์เอง — คนโพสต์ลงกลุ่ม Facebook เอง ทีละกลุ่ม (เจ้าของ 9 พ.ย. 2569 "ฉันจะให้คนสามารถโพสต์เองได้" · "เสนอมาดีมาก") ═══
 * เลือกกลุ่ม → เตรียมโพสต์ → แถวละกลุ่ม: คัดลอกข้อความ (ใส่ลิงก์สมัครของกลุ่มนั้นให้แล้ว) · เปิดกลุ่ม
 * ลิงก์กลุ่มละลิงก์ จด `note` = โพสต์เอง (`ensureSoGroupLinks`) ⇒ ผู้สมัครบอกได้ว่ามาจากกลุ่มไหน และโพสต์เองหรือ Autopost
 * ข้อความ = ที่แก้บันทึกไว้กับใบขอ (ช่อง "ข้อความประกาศ" ของ Autopost) · ไม่เคยแก้ = ข้อความที่ระบบร่าง
 */
export default function ManualPostPanel({ job, onChanged }: { job: JobRequest; onChanged?: () => void }) {
  const looked = useRecruiterContact(job.recruiter_contact ? null : job.recruiter_name);
  const contact = job.recruiter_contact ?? looked;
  /**
   * ข้อความประกาศแก้ได้ (เจ้าของ 13 พ.ย. 2569 "ตอนเลือกโพสต์เองมันไม่มีให้แก้ caption") — ช่องเดียวกับ Autopost
   * (`post_caption` ของใบขอ) แก้ที่ไหนก็ใช้ทั้งสองทาง · แก้แล้วบันทึกเองหลังหยุดพิมพ์ · ไม่แก้ = ข้อความที่ระบบร่าง
   */
  const draft = React.useMemo(() => buildAutopostCaption(job, { contact, link: AUTOPOST_LINK_PLACEHOLDER }), [job, contact]);
  const saved = job.public_post_text?.trim() || null;
  const [caption, setCaption] = React.useState(saved ?? '');
  const [edited, setEdited] = React.useState(Boolean(saved));
  const [dirty, setDirty] = React.useState<{ text: string | null } | null>(null);
  const [captionSave, setCaptionSave] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  React.useEffect(() => {
    if (!edited) setCaption(draft);
  }, [draft, edited]);
  // คีย์เดียวกับที่ API อ่านกลับ — ใบขอล่วงหน้าใช้ siamraj-pre:<เลข> (13 พ.ย. 2569 แคปชั่น Bitkub เด้งกลับเพราะเคยบันทึกด้วยเลขเปล่า)
  const noteKey = unitRequestNoteKey(job);
  React.useEffect(() => {
    if (!dirty) return;
    if (!noteKey) return;
    const pending = dirty;
    const t = window.setTimeout(() => {
      setCaptionSave('saving');
      saveUnitFieldOverridesPatch(noteKey, { post_caption: pending.text })
        .then(() => {
          setCaptionSave('saved');
          setDirty((cur) => (cur === pending ? null : cur));
        })
        .catch(() => setCaptionSave('error'));
    }, 900);
    return () => window.clearTimeout(t);
  }, [dirty, noteKey]);
  const [groups, setGroups] = React.useState<SoOptGroup[] | null>(null);
  const [postings, setPostings] = React.useState<RecruitPosting[] | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [channels, setChannels] = React.useState<RecruitChannelMatch[]>([]);
  const fbGroupChannel = channels.some((c) => isFacebookGroupChannel(c.name));
  const otherChannels = channels.filter((c) => !isFacebookGroupChannel(c.name));
  /** ต้องมีช่องทาง · เลือก Facebook Group แล้วต้องเลือกกลุ่มด้วย (กติกาเดียวกับ Gen link 4 พ.ย. 2569) */
  const linkCount = otherChannels.length + (fbGroupChannel ? picked.length : 0);
  const missingGroup = fbGroupChannel && picked.length === 0;
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [copied, setCopied] = React.useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    Promise.all([fetchSoOptions(job.request_no), fetchRecruitPostings({ jobId: job.id })])
      .then(([o, p]) => {
        if (!alive) return;
        setGroups(o.groups);
        setPostings(p);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setGroups([]);
        setError(e instanceof Error ? e.message : 'โหลดกลุ่ม Facebook ไม่ได้');
      });
    return () => {
      alive = false;
    };
  }, [job.id, job.request_no]);

  const prepare = async () => {
    if (busy || linkCount === 0 || missingGroup || (fbGroupChannel && !groups)) return;
    setBusy(true);
    setError(null);
    try {
      // ใบที่ยังไม่ประกาศ = ประกาศ + สร้างประกาศลิงก์กลาง (ชุดเดียวกับ Autopost)
      let posting = postings?.find((p) => p.status === 'open') ?? null;
      if (!posting) {
        posting = await createRecruitPosting(jobPostingBody(job));
        await releaseJobsToPublic([job.id]);
      }
      const made: RecruitPostingLink[] = [];
      const out: Row[] = [];
      // ช่องทางอื่น — ช่องละลิงก์ · มีลิงก์โพสต์เองของช่องนี้แล้วใช้ตัวเดิม (เตรียมซ้ำไม่งอกลิงก์)
      for (const c of otherChannels) {
        const label = recruitChannelLabel(c);
        let l = [...posting.links, ...made].find((x) => x.channelId === c.id && !x.fbGroupId && (x.note ?? '').trim() === SO_LINK_NOTE.manual) ?? null;
        if (!l) {
          l = await addPostingLink(posting.id, { channelId: c.id, channelLabel: label, note: SO_LINK_NOTE.manual });
          made.push(l);
        }
        out.push({ key: `c-${c.id}`, name: label, group: null, link: l });
      }
      if (fbGroupChannel && groups) {
        const g = await ensureSoGroupLinks({ ...posting, links: [...posting.links, ...made] }, groups.filter((x) => picked.includes(x.id)), groups, 'manual');
        made.push(...g.made);
        for (const r of g.links) out.push({ key: `g-${r.group.id}`, name: soGroupLinkName(r.group, groups), group: r.group, link: r.link });
      }
      // จำลิงก์ที่เพิ่งสร้าง — กด "เลือกใหม่" แล้วเตรียมซ้ำต้องได้ลิงก์เดิม ไม่สร้างซ้ำ
      const current = { ...posting, links: [...posting.links, ...made] };
      setPostings((prev) => [current, ...(prev ?? []).filter((p) => p.id !== current.id)]);
      setRows(out);
      if (made.length > 0) onChanged?.();
      setCopied(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เตรียมโพสต์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const textOf = (r: Row) => syncCaptionLink(caption, `${window.location.origin}${applyLinkPath(r.link.code)}`);
  // ตัวก๊อปปี้กลางของระบบ — clipboard ถูกกัน (หน้าต่างฝัง/บางเบราว์เซอร์) ถอยไปวิธีเดิมเอง (ทดสอบผ่านหน้าจอ 9 พ.ย. 2569 เคยขึ้นคัดลอกไม่ได้)
  const copy = async (r: Row) => {
    try {
      await copyText(textOf(r));
      setCopied((prev) => new Set(prev).add(r.key));
      setError(null);
    } catch {
      setError('คัดลอกไม่ได้ — ลองกดอีกครั้ง');
    }
  };

  if (rows) {
    return (
      <div className="space-y-2" data-testid="manual-post-rows">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">
            เตรียมโพสต์ {rows.length} ลิงก์ · <span className="tabular-nums">คัดลอกแล้ว {copied.size}/{rows.length}</span>
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRows(null)}>
            เลือกใหม่
          </Button>
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((r) => {
            const done = copied.has(r.key);
            return (
              <li key={r.key} className="flex flex-wrap items-center gap-2 px-3 py-2" data-testid="manual-post-row">
                <span className={cn('flex min-w-0 flex-1 items-center gap-1.5 text-sm', done ? DASH.sub : 'text-foreground')}>
                  {done ? <Check className={cn('h-4 w-4 shrink-0', TONE.success.value)} aria-hidden /> : null}
                  <span className="min-w-0 break-words">{r.name}</span>
                </span>
                <Button type="button" size="sm" variant={done ? 'outline' : 'default'} onClick={() => void copy(r)} data-testid="manual-post-copy">
                  <Copy aria-hidden />
                  {done ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
                </Button>
                {!r.group ? null : r.group.url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={r.group.url} target="_blank" rel="noopener noreferrer" data-testid="manual-post-open">
                      <ExternalLink aria-hidden />
                      เปิดกลุ่ม
                    </a>
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" disabled>
                    ไม่มีลิงก์กลุ่ม
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="manual-post">
      <MultiChannelPicker value={channels} onChange={setChannels} />
      {fbGroupChannel ? <SoGroupPicker groups={groups} jobBu={jobBuOf(job)} jobSector={jobUnitSectorOf(job)} value={picked} onChange={setPicked} /> : null}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={`manual-caption-${job.id}`} className="text-sm font-medium">
            ข้อความประกาศ
          </Label>
          {edited ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => {
                setEdited(false);
                setCaption(draft);
                setDirty({ text: null });
              }}
            >
              ใช้ข้อความที่ระบบร่าง
            </Button>
          ) : null}
        </div>
        <Textarea
          id={`manual-caption-${job.id}`}
          value={caption}
          onChange={(e) => {
            setCaption(e.target.value);
            setEdited(true);
            setDirty({ text: e.target.value });
          }}
          rows={12}
          data-testid="manual-post-caption"
        />
        <p className={cn('flex justify-between gap-2 text-xs tabular-nums', DASH.muted)}>
          <span className={captionSave === 'error' || !caption.includes(AUTOPOST_LINK_PLACEHOLDER) ? TONE.danger.value : undefined}>
            {!caption.includes(AUTOPOST_LINK_PLACEHOLDER)
              ? `ข้อความต้องมี ${AUTOPOST_LINK_PLACEHOLDER} ตรงที่จะใส่ลิงก์สมัคร`
              : captionSave === 'saving'
                ? 'กำลังบันทึก…'
                : captionSave === 'saved'
                  ? 'บันทึกแล้ว'
                  : captionSave === 'error'
                    ? 'บันทึกไม่สำเร็จ'
                    : ''}
          </span>
          <span className={caption.length > AUTOPOST_CAPTION_MAX ? TONE.danger.value : undefined}>
            {caption.length.toLocaleString('th-TH')}/{AUTOPOST_CAPTION_MAX.toLocaleString('th-TH')}
          </span>
        </p>
      </section>
      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      <Button
        type="button"
        disabled={busy || linkCount === 0 || missingGroup || !caption.includes(AUTOPOST_LINK_PLACEHOLDER) || caption.length > AUTOPOST_CAPTION_MAX}
        onClick={() => void prepare()}
        data-testid="manual-post-prepare"
      >
        {busy ? 'กำลังเตรียม…' : missingGroup ? 'เลือกกลุ่ม Facebook' : `เตรียมโพสต์ ${linkCount} ลิงก์`}
      </Button>
    </div>
  );
}
