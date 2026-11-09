import React from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { useRecruiterContact } from '@/hooks/useRecruiterContact';
import { jobUnitSectorOf } from '@/lib/unitRequestDisplay';
import { fetchSoOptions } from '@/lib/jobPostingRequestsApi';
import { createRecruitPosting, fetchRecruitPostings } from '@/lib/recruitPostingsApi';
import { jobPostingBody } from '@/lib/recruitPostingDraft';
import { releaseJobsToPublic } from '@/lib/jobPublicReleaseApi';
import { applyLinkPath, type RecruitPosting, type RecruitPostingLink } from '@/lib/recruitPostings';
import { AUTOPOST_LINK_PLACEHOLDER } from '@/lib/postText';
import { buildAutopostCaption } from '@/lib/autopostCaption';
import { ensureSoGroupLinks } from '@/lib/soGroupLinks';
import { jobBuOf, soGroupLinkName, type SoOptGroup } from '@/lib/soScraping';
import SoGroupPicker from '@/components/jobs/SoGroupPicker';
import { syncCaptionLink } from '@/components/jobs/AutopostDialog';

type Row = { group: SoOptGroup; link: RecruitPostingLink };

/**
 * ═══ โพสต์เอง — คนโพสต์ลงกลุ่ม Facebook เอง ทีละกลุ่ม (เจ้าของ 9 พ.ย. 2569 "ฉันจะให้คนสามารถโพสต์เองได้" · "เสนอมาดีมาก") ═══
 * เลือกกลุ่ม → เตรียมโพสต์ → แถวละกลุ่ม: คัดลอกข้อความ (ใส่ลิงก์สมัครของกลุ่มนั้นให้แล้ว) · เปิดกลุ่ม
 * ลิงก์กลุ่มละลิงก์ จด `note` = โพสต์เอง (`ensureSoGroupLinks`) ⇒ ผู้สมัครบอกได้ว่ามาจากกลุ่มไหน และโพสต์เองหรือ Autopost
 * ข้อความ = ที่แก้บันทึกไว้กับใบขอ (ช่อง "ข้อความประกาศ" ของ Autopost) · ไม่เคยแก้ = ข้อความที่ระบบร่าง
 */
export default function ManualPostPanel({ job }: { job: JobRequest }) {
  const looked = useRecruiterContact(job.recruiter_contact ? null : job.recruiter_name);
  const contact = job.recruiter_contact ?? looked;
  const caption = React.useMemo(
    () => job.public_post_text?.trim() || buildAutopostCaption(job, { contact, link: AUTOPOST_LINK_PLACEHOLDER }),
    [job, contact],
  );
  const [groups, setGroups] = React.useState<SoOptGroup[] | null>(null);
  const [postings, setPostings] = React.useState<RecruitPosting[] | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
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
    if (busy || !groups || picked.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      // ใบที่ยังไม่ประกาศ = ประกาศ + สร้างประกาศลิงก์กลาง (ชุดเดียวกับ Autopost)
      let posting = postings?.find((p) => p.status === 'open') ?? null;
      if (!posting) {
        posting = await createRecruitPosting(jobPostingBody(job));
        await releaseJobsToPublic([job.id]);
      }
      const { links } = await ensureSoGroupLinks(posting, groups.filter((g) => picked.includes(g.id)), groups, 'manual');
      setRows(links);
      setCopied(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เตรียมโพสต์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const textOf = (r: Row) => syncCaptionLink(caption, `${window.location.origin}${applyLinkPath(r.link.code)}`);
  const copy = async (r: Row) => {
    try {
      await navigator.clipboard.writeText(textOf(r));
      setCopied((prev) => new Set(prev).add(r.group.id));
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
            เตรียมโพสต์ {rows.length} กลุ่ม · <span className="tabular-nums">คัดลอกแล้ว {copied.size}/{rows.length}</span>
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRows(null)}>
            เลือกกลุ่มใหม่
          </Button>
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((r) => {
            const done = copied.has(r.group.id);
            return (
              <li key={r.group.id} className="flex flex-wrap items-center gap-2 px-3 py-2" data-testid="manual-post-row">
                <span className={cn('flex min-w-0 flex-1 items-center gap-1.5 text-sm', done ? DASH.sub : 'text-foreground')}>
                  {done ? <Check className={cn('h-4 w-4 shrink-0', TONE.success.value)} aria-hidden /> : null}
                  <span className="truncate">{soGroupLinkName(r.group, groups ?? [])}</span>
                </span>
                <Button type="button" size="sm" variant={done ? 'outline' : 'default'} onClick={() => void copy(r)} data-testid="manual-post-copy">
                  <Copy aria-hidden />
                  {done ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
                </Button>
                {r.group.url ? (
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
      <SoGroupPicker groups={groups} jobBu={jobBuOf(job)} jobSector={jobUnitSectorOf(job)} value={picked} onChange={setPicked} />
      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      <Button type="button" disabled={busy || picked.length === 0} onClick={() => void prepare()} data-testid="manual-post-prepare">
        {busy ? 'กำลังเตรียม…' : `เตรียมโพสต์ ${picked.length} กลุ่ม`}
      </Button>
    </div>
  );
}
