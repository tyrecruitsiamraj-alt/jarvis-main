import React from 'react';
import { Link2, LoaderCircle, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { FieldSelect } from '@/components/shared/FieldSelect';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { useRecruiterContact } from '@/hooks/useRecruiterContact';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { publicJobTitle } from '@/lib/publicJobTitle';
import { addPostingLink, fetchRecruitPostings } from '@/lib/recruitPostingsApi';
import { applyLinkPath, type RecruitPosting } from '@/lib/recruitPostings';
import {
  composeJobSnapshot,
  createJobPostingRequest,
  fetchAutopostOptions,
  fetchJobPostingState,
  type AutopostOptions,
  type JobPostingRequest,
} from '@/lib/jobPostingRequestsApi';
import {
  SO_POST_MODES,
  SO_POST_MODE_LABEL,
  SO_POST_REASON,
  jobProvinceOf,
  soPostSnapshot,
  soStatusView,
  sortSoGroups,
  type SoPostMode,
} from '@/lib/soScraping';
import { AUTOPOST_CAPTION_MAX, autopostMissing, buildAutopostCaption, captionLeaks } from '@/lib/autopostCaption';

/**
 * ═══ ป๊อป Autopost — กดจากปุ่มบนการ์ดกล่องงาน (เจ้าของ 20 ต.ค. 2569 Choice "บนการ์ดกล่องงาน") ═══
 * Journey ที่เจ้าของเคาะ: เปิดกล่องงาน → กด Autopost → ป๊อป: ตัวอย่างแคปชั่น (แก้ได้) → ลิงก์ → Account → กลุ่ม → Worker → ส่ง
 * - แคปชั่นร่างจากของที่ทีมกรอกในป๊อปประกาศ (`buildAutopostCaption`) · ค่าที่บันทึก = ฉบับที่เห็นตอนกดส่ง
 * - ขาดช่องบังคับ (ตำแหน่ง · สถานที่ · ฐานเงินเดือน · วันเวลาทำงาน · ลิงก์สมัคร) = กดส่งไม่ได้ และบอกว่าขาดอะไร
 * - กลุ่ม = เฉพาะของบัญชีที่เลือก · เตือนกลุ่มที่ใบนี้เพิ่งสั่งไปใน 3 วัน (กันบัญชีโดนแบน)
 * - Worker ตั้งต้น "อัตโนมัติ" (worker ประจำของบัญชี)
 * 🔴 Jarvis ไม่โพสต์ Facebook เอง — เขียนคำขอให้ So Scraping · ห้ามซ้อน Dialog (เปิดจาก JobBoardView ไม่ใช่ในการ์ด)
 */
const NUM = new Intl.NumberFormat('th-TH');
const WHEN = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const AUTO_WORKER = '__auto__';
const NEW_LINK_LABEL = 'Facebook Group';

export default function AutopostDialog({
  job,
  onClose,
  onSent,
}: {
  job: JobRequest | null;
  onClose: () => void;
  onSent?: (item: JobPostingRequest) => void;
}) {
  return (
    <Dialog open={job !== null} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {job ? <AutopostBody key={job.id} job={job} onSent={onSent} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AutopostBody({ job, onSent, onClose }: { job: JobRequest; onSent?: (item: JobPostingRequest) => void; onClose: () => void }) {
  const looked = useRecruiterContact(job.recruiter_contact ? null : job.recruiter_name);
  const contact = job.recruiter_contact ?? looked;
  const province = jobProvinceOf(job);

  const [postings, setPostings] = React.useState<RecruitPosting[] | null>(null);
  const [opts, setOpts] = React.useState<AutopostOptions | null>(null);
  const [state, setState] = React.useState<{ latest: JobPostingRequest[]; recentGroups: string[] } | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [mode, setMode] = React.useState<SoPostMode>('caption_only');
  const [linkCode, setLinkCode] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [picked, setPicked] = React.useState<string[]>([]);
  const [worker, setWorker] = React.useState(AUTO_WORKER);
  const [caption, setCaption] = React.useState('');
  const [captionEdited, setCaptionEdited] = React.useState(false);
  const [busy, setBusy] = React.useState<'send' | 'link' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<JobPostingRequest | null>(null);

  React.useEffect(() => {
    let alive = true;
    Promise.all([fetchRecruitPostings({ jobId: job.id }), fetchAutopostOptions(), fetchJobPostingState(job.id)])
      .then(([p, o, s]) => {
        if (!alive) return;
        setPostings(p);
        setOpts(o);
        setState(s);
        const open = p.find((x) => x.status === 'open');
        const fb = open?.links.find((l) => /facebook/i.test(l.channelLabel ?? '')) ?? open?.links[0];
        if (fb) setLinkCode(fb.code);
        const acc = o.accounts.find((a) => !isPaused(a.pausedUntil)) ?? o.accounts[0];
        if (acc) {
          setAccountId(acc.id);
          setPicked(defaultGroups(o, acc.id, province, s.recentGroups));
        }
      })
      .catch((e) => alive && setLoadError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่ได้'));
    return () => {
      alive = false;
    };
  }, [job.id, province]);

  const openPosting = postings?.find((p) => p.status === 'open') ?? null;
  const links = openPosting?.links ?? [];
  const linkUrl = linkCode ? `${window.location.origin}${applyLinkPath(linkCode)}` : null;
  const account = opts?.accounts.find((a) => a.id === accountId) ?? null;
  const accountGroups = React.useMemo(
    () => (opts && account ? sortSoGroups(opts.groups.filter((g) => account.groupIds.includes(g.id)), province) : []),
    [opts, account, province],
  );
  const recent = new Set(state?.recentGroups ?? []);
  const openOrder = state?.latest.find((r) => r.request_type === 'content' && soStatusView(r).open) ?? null;

  // แคปชั่นร่างใหม่ตามลิงก์ที่เลือก จนกว่าคนจะแก้เอง · แก้แล้วเปลี่ยนลิงก์ = แทนเฉพาะ URL เดิม
  const draft = React.useMemo(() => buildAutopostCaption(job, { contact, link: linkUrl }), [job, contact, linkUrl]);
  const prevLink = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!captionEdited) setCaption(draft);
    else if (prevLink.current && linkUrl && prevLink.current !== linkUrl) setCaption((c) => c.split(prevLink.current as string).join(linkUrl));
    prevLink.current = linkUrl;
  }, [draft, linkUrl, captionEdited]);

  const missing = autopostMissing(job, { hasLink: Boolean(linkUrl) });
  const leaks = captionLeaks(caption);
  const problems = [
    ...missing.map((m) => `ขาด${m}`),
    ...(account ? [] : ['เลือกบัญชี Facebook']),
    ...(account && isPaused(account.pausedUntil) ? [`บัญชี ${account.name} ถูกพักอยู่`] : []),
    ...(picked.length === 0 ? ['เลือกกลุ่มอย่างน้อย 1 กลุ่ม'] : []),
    ...(mode !== 'image_only' && !caption.trim() ? ['ใส่ข้อความประกาศ'] : []),
    ...(mode !== 'image_only' && linkUrl && !caption.includes(linkUrl) ? ['ข้อความต้องมีลิงก์สมัครที่เลือก'] : []),
    ...leaks.map((l) => `ข้อความมี${l} — ลบออกก่อน`),
    ...(caption.length > AUTOPOST_CAPTION_MAX ? [`ข้อความยาวเกิน ${NUM.format(AUTOPOST_CAPTION_MAX)} ตัวอักษร`] : []),
  ];

  const createLink = async () => {
    if (!openPosting || busy) return;
    setBusy('link');
    setError(null);
    try {
      const names = accountGroups.filter((g) => picked.includes(g.id)).map((g) => g.name);
      const label = names.length > 0 ? `${NEW_LINK_LABEL} · ${names.join(', ')}`.slice(0, 120) : NEW_LINK_LABEL;
      const link = await addPostingLink(openPosting.id, { channelLabel: label });
      setPostings((prev) => (prev ?? []).map((p) => (p.id === openPosting.id ? { ...p, links: [...p.links, link] } : p)));
      setLinkCode(link.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างลิงก์ไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (busy || problems.length > 0 || !account || !linkUrl) return;
    setBusy('send');
    setError(null);
    try {
      const link = links.find((l) => l.code === linkCode);
      const item = await createJobPostingRequest({
        jobId: job.id,
        requestNo: job.request_no,
        reason: SO_POST_REASON,
        requestType: 'content',
        jobSnapshot: {
          ...soPostSnapshot({ ...composeJobSnapshot(job), position: publicJobTitle(job) }, { mode, caption, groupIds: picked }),
          account_id: account.id,
          account_name: account.name,
          worker_id: worker === AUTO_WORKER ? null : worker,
          apply_link: linkUrl,
          link_code: linkCode,
          channel_label: link?.channelLabel ?? null,
        },
      });
      setSent(item);
      onSent?.(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่งไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const loading = !postings || !opts || !state;

  return (
    <div className="space-y-4" data-testid="autopost-dialog">
      <DialogHeader>
        <DialogTitle>Autopost · {jobBoardCardTitle(job)}</DialogTitle>
        <DialogDescription>{publicJobTitle(job)}</DialogDescription>
      </DialogHeader>

      {loadError ? <p className={cn('text-sm', TONE.danger.value)}>{loadError}</p> : null}
      {loading && !loadError ? <p className={cn('text-sm', DASH.muted)}>กำลังโหลด…</p> : null}

      {sent ? (
        <div className="space-y-3" data-testid="autopost-sent">
          <p className="text-sm text-foreground">
            ส่งให้ So Scraping แล้ว ·{' '}
            <Badge variant="outline" className={cn('font-medium', TONE[soStatusView(sent).tone].outline)}>
              {soStatusView(sent).label}
            </Badge>
          </p>
          <Button type="button" variant="outline" onClick={onClose}>
            ปิด
          </Button>
        </div>
      ) : loading ? null : (
        <>
          {openOrder ? (
            <p className={cn('rounded-xl border px-3 py-2 text-sm', TONE.warn.soft)} data-testid="autopost-open-order">
              มีคำสั่งโพสต์ค้างอยู่ · {soStatusView(openOrder).label} — รอให้เสร็จก่อนถึงสั่งใหม่ได้
            </p>
          ) : null}

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor={`autopost-caption-${job.id}`} className="text-sm font-medium">
                ข้อความประกาศ
              </Label>
              {captionEdited ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setCaptionEdited(false);
                    setCaption(draft);
                  }}
                >
                  ใช้ข้อความที่ระบบร่าง
                </Button>
              ) : null}
            </div>
            <Textarea
              id={`autopost-caption-${job.id}`}
              value={caption}
              onChange={(e) => {
                setCaption(e.target.value);
                setCaptionEdited(true);
              }}
              rows={14}
              data-testid="autopost-caption"
            />
            <p className={cn('text-right text-xs tabular-nums', caption.length > AUTOPOST_CAPTION_MAX ? TONE.danger.value : DASH.muted)}>
              {NUM.format(caption.length)}/{NUM.format(AUTOPOST_CAPTION_MAX)}
            </p>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as SoPostMode)} className="flex flex-wrap gap-x-4 gap-y-2">
              {SO_POST_MODES.map((m) => (
                <div key={m} className="flex items-center gap-2">
                  <RadioGroupItem value={m} id={`autopost-mode-${job.id}-${m}`} />
                  <Label htmlFor={`autopost-mode-${job.id}-${m}`} className="text-sm font-normal">
                    {SO_POST_MODE_LABEL[m]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium text-foreground">ลิงก์สมัคร</p>
            {openPosting ? (
              <div className="flex flex-wrap items-center gap-2">
                <FieldSelect
                  value={linkCode}
                  onChange={setLinkCode}
                  placeholder="เลือกลิงก์"
                  ariaLabel="ลิงก์สมัคร"
                  className="min-w-0 flex-1"
                  testId="autopost-link"
                  options={links.map((l) => ({
                    value: l.code,
                    label: `${l.channelLabel || 'ลิงก์ประกาศ'} · ${l.code}${l.applicationCount ? ` · สมัคร ${NUM.format(l.applicationCount)}` : ''}`,
                  }))}
                />
                <Button type="button" size="sm" variant="outline" onClick={() => void createLink()} disabled={busy !== null}>
                  {busy === 'link' ? <LoaderCircle className="animate-spin" aria-hidden /> : <Link2 aria-hidden />}
                  สร้างลิงก์ใหม่ Facebook
                </Button>
              </div>
            ) : (
              <p className={cn('text-sm', TONE.warn.value)}>ใบนี้ยังไม่ได้ประกาศ — ประกาศก่อนถึงมีลิงก์สมัคร</p>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium text-foreground">บัญชี Facebook</p>
            {opts.accounts.length === 0 ? (
              <p className={cn('text-sm', TONE.warn.value)}>ยังไม่มีบัญชี ให้เพิ่มที่ระบบ So Scraping</p>
            ) : (
              <>
                <FieldSelect
                  value={accountId}
                  onChange={(v) => {
                    setAccountId(v);
                    setPicked(defaultGroups(opts, v, province, state.recentGroups));
                  }}
                  placeholder="เลือกบัญชี"
                  ariaLabel="บัญชี Facebook"
                  testId="autopost-account"
                  options={opts.accounts.map((a) => ({ value: a.id, label: a.name }))}
                />
                {account ? (
                  <p className={cn('text-xs', isPaused(account.pausedUntil) ? TONE.danger.value : DASH.muted)} data-testid="autopost-account-status">
                    {isPaused(account.pausedUntil)
                      ? `พักอยู่ถึง ${WHEN.format(new Date(account.pausedUntil as string))}${account.pauseReason ? ` · ${account.pauseReason}` : ''}`
                      : `วันนี้โพสต์ไป ${NUM.format(account.postedToday)}${account.dailyCap ? `/${NUM.format(account.dailyCap)}` : ''} โพสต์`}
                  </p>
                ) : null}
              </>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium text-foreground">กลุ่ม Facebook</p>
            {!account ? null : accountGroups.length === 0 ? (
              <p className={cn('text-sm', TONE.warn.value)}>บัญชีนี้ยังไม่มีกลุ่ม ให้เพิ่มที่ระบบ So Scraping</p>
            ) : (
              <ul className="space-y-2" data-testid="autopost-groups">
                {accountGroups.map((g) => (
                  <li key={g.id} className="flex items-start gap-2">
                    <Checkbox
                      id={`autopost-group-${job.id}-${g.id}`}
                      checked={picked.includes(g.id)}
                      onCheckedChange={(v) =>
                        setPicked((prev) => (v === true ? [...new Set([...prev, g.id])] : prev.filter((x) => x !== g.id)))
                      }
                      className="mt-0.5"
                    />
                    <Label htmlFor={`autopost-group-${job.id}-${g.id}`} className="space-y-0.5 font-normal">
                      <span className="block text-sm text-foreground">{g.name}</span>
                      <span className={cn('block text-xs', DASH.muted)}>
                        {[g.province, recent.has(g.id) ? 'ใบนี้เพิ่งสั่งโพสต์กลุ่มนี้ใน 3 วัน' : null].filter(Boolean).join(' · ')}
                      </span>
                    </Label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium text-foreground">Worker</p>
            <FieldSelect
              value={worker}
              onChange={setWorker}
              ariaLabel="Worker"
              testId="autopost-worker"
              options={[
                {
                  value: AUTO_WORKER,
                  label: `อัตโนมัติ${account?.preferredWorker ? ` · ${account.preferredWorker}` : ''}`,
                },
                ...opts.workers.map((w) => ({
                  value: w.name,
                  label: `${w.name} · ${w.online ? 'ออนไลน์' : w.lastSeen ? `ออฟไลน์ตั้งแต่ ${WHEN.format(new Date(w.lastSeen))}` : 'ออฟไลน์'}`,
                })),
              ]}
            />
          </section>

          {problems.length > 0 ? (
            <ul className={cn('space-y-0.5 text-xs', TONE.warn.value)} data-testid="autopost-problems">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          {error ? (
            <p role="alert" className={cn('text-sm', TONE.danger.value)}>
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void send()}
              disabled={busy !== null || problems.length > 0 || openOrder !== null}
              data-testid="autopost-send"
            >
              {busy === 'send' ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              {busy === 'send' ? 'กำลังส่ง…' : 'ส่ง Autopost'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy !== null}>
              ยกเลิก
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function isPaused(until: string | null): boolean {
  return Boolean(until && Date.parse(until) > Date.now());
}

/** ติ๊กไว้ให้ก่อน = กลุ่มของบัญชีที่จังหวัดตรงกับใบขอ และยังไม่ได้สั่งโพสต์ใน 3 วัน */
function defaultGroups(o: AutopostOptions, accountId: string, province: string | null, recent: readonly string[]): string[] {
  const acc = o.accounts.find((a) => a.id === accountId);
  if (!acc || !province) return [];
  return o.groups
    .filter((g) => acc.groupIds.includes(g.id) && (g.province ?? '').trim() === province && !recent.includes(g.id))
    .map((g) => g.id);
}
