import React from 'react';
import { LoaderCircle, Search, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { buildPostText } from '@/lib/postText';
import {
  composeJobSnapshot,
  createJobPostingRequest,
  fetchSoGroups,
  listLatestJobPostingsForJob,
  type JobPostingRequest,
} from '@/lib/jobPostingRequestsApi';
import {
  SO_POST_MODES,
  SO_POST_MODE_LABEL,
  SO_POST_REASON,
  SO_SCRAP_REASON,
  defaultSoGroupIds,
  jobProvinceOf,
  soPostOrderError,
  soPostSnapshot,
  soScrapMissing,
  soScrapSnapshot,
  soStatusView,
  sortSoGroups,
  type SoGroup,
  type SoPostMode,
} from '@/lib/soScraping';

/**
 * ═══ สั่งโพสต์ / ขอ Scrap ไประบบ So Scraping — ใต้การ์ดตัวอย่างในป๊อปประกาศ (เจ้าของ 20 ต.ค. 2569) ═══
 * เดิม (15 ต.ค.) ส่งแค่ข้อมูลใบขอ ไม่มีข้อความประกาศ/แบบโพสต์ ⇒ So Scraping โพสต์ต่อไม่ได้ งานค้าง "รอดำเนินการ"
 * - สั่งโพสต์: เลือกแบบโพสต์ · แก้ข้อความประกาศ · ติ๊กกลุ่ม Facebook (กลุ่มจังหวัดเดียวกับใบขอขึ้นก่อนและติ๊กไว้ให้)
 *   บันทึกข้อความฉบับสุดท้ายที่เห็นลง `job_snapshot.caption` + `post_mode` + `group_ids`
 * - ขอ Scrap: ที่นี่ที่เดียว (Choice "ย้ายมาไว้หน้านี้เท่านั้น") · ต้องมีตำแหน่ง/จังหวัด/จำนวนคน · ขาดอะไรบอก
 * - สถานะที่ So Scraping เขียนกลับโชว์ทุกครั้งที่เปิด (ไม่ใช่แค่ตอนยังเปิด) · ไม่รับงาน = เหตุผลจาก notes
 * - ยังรอ/กำลังทำ = กดซ้ำไม่ได้ · โพสต์แล้ว/เสร็จ/ไม่รับงาน = สั่งใหม่ได้ (Choice "ได้ หลังโพสต์แล้ว")
 * 🔴 Jarvis ไม่โพสต์ Facebook เอง — แค่เขียนคำขอ · ไม่ซ้อน Dialog (ฟอร์มกางในป๊อปเดิม)
 */
export default function OrderPostButton({ job, caption: captionDefault }: { job: JobRequest; caption?: string | null }) {
  const [latest, setLatest] = React.useState<JobPostingRequest[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<'content' | 'scraping' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [mode, setMode] = React.useState<SoPostMode>('caption_only');
  const [caption, setCaption] = React.useState('');
  const [groups, setGroups] = React.useState<SoGroup[] | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const province = jobProvinceOf(job);

  React.useEffect(() => {
    let alive = true;
    setLatest(null);
    setLoadError(null);
    listLatestJobPostingsForJob(job.id)
      .then((list) => alive && setLatest(list))
      .catch((e) => alive && setLoadError(e instanceof Error ? e.message : 'โหลดสถานะไม่ได้'));
    return () => {
      alive = false;
    };
  }, [job.id]);

  const content = latest?.find((p) => p.request_type === 'content') ?? null;
  const scraping = latest?.find((p) => p.request_type === 'scraping') ?? null;
  const contentView = content ? soStatusView(content) : null;
  const scrapingView = scraping ? soStatusView(scraping) : null;
  const scrapMissing = soScrapMissing(job);
  const orderError = soPostOrderError({ mode, caption, groupIds: picked });

  const openForm = () => {
    setError(null);
    setCaption((c) => c || captionDefault || buildPostText(job, null));
    setFormOpen(true);
    if (groups === null) {
      fetchSoGroups()
        .then((list) => {
          const sorted = sortSoGroups(list, province);
          setGroups(sorted);
          setPicked(defaultSoGroupIds(sorted, province));
        })
        .catch((e) => {
          setGroups([]);
          setError(e instanceof Error ? e.message : 'โหลดกลุ่ม Facebook ไม่ได้');
        });
    }
  };

  const save = async (type: 'content' | 'scraping') => {
    if (busy) return;
    setBusy(type);
    setError(null);
    try {
      const item = await createJobPostingRequest({
        jobId: job.id,
        requestNo: job.request_no,
        reason: type === 'content' ? SO_POST_REASON : SO_SCRAP_REASON,
        requestType: type,
        jobSnapshot:
          type === 'content'
            ? soPostSnapshot(composeJobSnapshot(job), { mode, caption, groupIds: picked })
            : soScrapSnapshot(job),
      });
      setLatest((prev) => [item, ...(prev ?? []).filter((p) => p.request_type !== type)]);
      if (type === 'content') setFormOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : type === 'content' ? 'สั่งโพสต์ไม่สำเร็จ' : 'ขอ Scrap ไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const statusRow = (label: string, req: JobPostingRequest | null, view: ReturnType<typeof soStatusView> | null, testId: string) => (
    <div className="space-y-1" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        {latest === null && !loadError ? (
          <span className={cn('text-xs', DASH.muted)}>กำลังโหลด…</span>
        ) : view ? (
          <Badge variant="outline" className={cn('font-medium', TONE[view.tone].outline)}>
            {view.label}
          </Badge>
        ) : (
          <span className={cn('text-xs', DASH.muted)}>ยังไม่ได้สั่ง</span>
        )}
      </div>
      {req?.status === 'rejected' && req.notes?.trim() ? (
        <p className={cn('text-xs', TONE.danger.value)}>เหตุผล: {req.notes.trim()}</p>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-3 rounded-xl border border-border/70 p-3" data-testid="order-post">
      <div className="space-y-2">
        {statusRow('โพสต์', content, contentView, 'so-status-content')}
        {statusRow('Scrap', scraping, scrapingView, 'so-status-scraping')}
        {loadError ? <p className={cn('text-xs', TONE.danger.value)}>{loadError}</p> : null}
      </div>

      {!formOpen ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1"
            disabled={latest === null || Boolean(contentView?.open)}
            onClick={openForm}
            data-testid="so-order-post"
          >
            <Send aria-hidden />
            สั่งโพสต์
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={latest === null || Boolean(scrapingView?.open) || scrapMissing.length > 0 || busy !== null}
            onClick={() => void save('scraping')}
            data-testid="so-order-scrap"
          >
            {busy === 'scraping' ? <LoaderCircle className="animate-spin" aria-hidden /> : <Search aria-hidden />}
            {busy === 'scraping' ? 'กำลังส่ง…' : 'ขอ Scrap'}
          </Button>
        </div>
      ) : null}
      {!formOpen && scrapMissing.length > 0 && !scrapingView?.open ? (
        <p className={cn('text-xs', TONE.warn.value)} data-testid="so-scrap-missing">
          ขอ Scrap ไม่ได้ ขาด{scrapMissing.join(' · ')}
        </p>
      ) : null}

      {formOpen ? (
        <div className="space-y-3" data-testid="so-post-form">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">แบบโพสต์</p>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as SoPostMode)} className="flex flex-wrap gap-x-4 gap-y-2">
              {SO_POST_MODES.map((m) => (
                <div key={m} className="flex items-center gap-2">
                  <RadioGroupItem value={m} id={`so-mode-${job.id}-${m}`} />
                  <Label htmlFor={`so-mode-${job.id}-${m}`} className="text-sm font-normal">
                    {SO_POST_MODE_LABEL[m]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {mode !== 'caption_only' ? <p className={cn('text-xs', DASH.muted)}>รูปแนบที่ระบบ So Scraping</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`so-caption-${job.id}`} className="text-sm font-medium">
              ข้อความประกาศ{mode === 'image_only' ? ' (ไม่ใส่ก็ได้)' : ''}
            </Label>
            <Textarea
              id={`so-caption-${job.id}`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={8}
              data-testid="so-caption"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">กลุ่ม Facebook</p>
            {groups === null ? (
              <p className={cn('text-xs', DASH.muted)}>กำลังโหลดกลุ่ม…</p>
            ) : groups.length === 0 ? (
              <p className={cn('text-xs', TONE.warn.value)} data-testid="so-groups-empty">
                ยังไม่มีกลุ่ม ให้เพิ่มที่ระบบ So Scraping
              </p>
            ) : (
              <ul className="space-y-2" data-testid="so-groups">
                {groups.map((g) => {
                  const on = picked.includes(g.id);
                  return (
                    <li key={g.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`so-group-${job.id}-${g.id}`}
                        checked={on}
                        onCheckedChange={(v) =>
                          setPicked((prev) => (v === true ? [...new Set([...prev, g.id])] : prev.filter((x) => x !== g.id)))
                        }
                        className="mt-0.5"
                      />
                      <Label htmlFor={`so-group-${job.id}-${g.id}`} className="space-y-0.5 font-normal">
                        <span className="block text-sm text-foreground">{g.name}</span>
                        {g.province ? (
                          <span className={cn('block text-xs', g.province === province ? TONE.success.value : DASH.muted)}>
                            {g.province}
                          </span>
                        ) : null}
                      </Label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {orderError ? (
            <p className={cn('text-xs', TONE.warn.value)} data-testid="so-post-error">
              {orderError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={Boolean(orderError) || busy !== null}
              onClick={() => void save('content')}
              data-testid="so-post-confirm"
            >
              {busy === 'content' ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              {busy === 'content' ? 'กำลังสั่งโพสต์…' : 'สั่งโพสต์'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setFormOpen(false)} disabled={busy !== null}>
              ยกเลิก
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={cn('text-xs', TONE.danger.value)}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
