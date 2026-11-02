import React from 'react';
import { ChevronDown, Link2, LoaderCircle, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldSelect } from '@/components/shared/FieldSelect';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { useRecruiterContact } from '@/hooks/useRecruiterContact';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { publicJobTitle } from '@/lib/publicJobTitle';
import { addPostingLink, fetchRecruitPostings } from '@/lib/recruitPostingsApi';
import { saveUnitFieldOverridesPatch } from '@/lib/siamrajUnitRequestsApi';
import { applyLinkPath, postingLinkOwner, type RecruitPosting } from '@/lib/recruitPostings';
import {
  composeJobSnapshot,
  createJobPostingRequest,
  fetchJobPostingState,
  fetchSoOptions,
  type JobPostingRequest,
} from '@/lib/jobPostingRequestsApi';
import {
  SO_ACCOUNT_STATUS_LABEL,
  SO_POST_MODES,
  SO_POST_MODE_LABEL,
  SO_POST_REASON,
  soAccountOnWorker,
  soGroupStatsText,
  soPostConfirmWarnings,
  soWorkersFor,
  soAccountSelectable,
  soGroupLabel,
  soGroupsOfAccount,
  soGroupSections,
  defaultSoGroupPick,
  jobBuOf,
  soBuEmptyText,
  soGroupView,
  soSectionHeadText,
  soBuNoAccountText,
  soAccountsByBu,
  soAccountsForJob,
  type SoGroupSection,
  soPostSnapshot,
  soStatusView,
  soWarningText,
  type SoOptAccount,
  type SoOptGroup,
  type SoOptions,
  type SoPostMode,
} from '@/lib/soScraping';
import SoStartLine from '@/components/jobs/SoStartLine';
import { AUTOPOST_CAPTION_MAX, autopostMissing, buildAutopostCaption, captionLeaks } from '@/lib/autopostCaption';

/**
 * ═══ ป๊อป Autopost — กดจากปุ่มบนการ์ดกล่องงาน (เจ้าของ 20 ต.ค. 2569 Choice "บนการ์ดกล่องงาน") ═══
 * Journey ที่เจ้าของเคาะ: เปิดกล่องงาน → กด Autopost → ป๊อป: ตัวอย่างแคปชั่น (แก้ได้) → ลิงก์ → Account → กลุ่ม → Worker → ส่ง
 * - แคปชั่นร่างจากของที่ทีมกรอกในป๊อปประกาศ (`buildAutopostCaption`) · ค่าที่บันทึก = ฉบับที่เห็นตอนกดส่ง
 * - ขาดช่องบังคับ (ตำแหน่ง · สถานที่ · ฐานเงินเดือน · วันเวลาทำงาน · ลิงก์สมัคร) = กดส่งไม่ได้ และบอกว่าขาดอะไร
 * - กลุ่ม = เฉพาะของบัญชีที่เลือก · เตือนกลุ่มที่ใบนี้เพิ่งสั่งไปใน 3 วัน (กันบัญชีโดนแบน)
 * - 26 ต.ค. 2569 (เอกสาร options API ของ So Scraping): บัญชี/กลุ่ม/เครื่องมาจาก So Scraping ดึงใหม่ทุกครั้งที่เปิด
 *   เลือกเครื่องเองไม่ได้ (session อยู่เครื่องเดียว) — โชว์เครื่อง + งานค้างข้างบัญชีแทน
 *   ถูกพัก / เครื่องออฟไลน์ = เลือกไม่ได้ ขึ้นกล่องเตือน · ครบโควต้า = เตือนก่อนส่ง กดส่งต่อได้
 *   กล่องเตือนอยู่ในป๊อปเดิม (กติกาห้ามซ้อนป๊อป) · ข้อความใช้ `warning` ของ So Scraping
 * 🔴 Jarvis ไม่โพสต์ Facebook เอง — เขียนคำขอให้ So Scraping · ห้ามซ้อน Dialog (เปิดจาก JobBoardView ไม่ใช่ในการ์ด)
 */
const NUM = new Intl.NumberFormat('th-TH');
const WHEN = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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

/**
 * ฟอร์ม Autopost — ใช้ในป๊อปของตัวเอง หรือ `embedded` ฝังในป๊อปประกาศ (`OrderPostButton` · เจ้าของ 21 ต.ค. 2569
 * Choice "เพิ่มปุ่ม Autopost ในป๊อปนี้") · ฝังแล้วไม่ใช้ DialogHeader — ห้ามซ้อน Dialog
 */
export function AutopostBody({
  job,
  onSent,
  onClose,
  embedded = false,
  onCaptionSaved,
}: {
  job: JobRequest;
  onSent?: (item: JobPostingRequest) => void;
  onClose: () => void;
  embedded?: boolean;
  /** ข้อความที่แก้ถูกบันทึกกับใบขอแล้ว (null = กลับไปใช้ข้อความที่ระบบร่าง) — การ์ดตัวอย่างเปลี่ยนตาม (28 ต.ค. 2569) */
  onCaptionSaved?: (text: string | null) => void;
}) {
  const looked = useRecruiterContact(job.recruiter_contact ? null : job.recruiter_name);
  const contact = job.recruiter_contact ?? looked;
  /** ธุรกิจของใบขอ — หมวดกลุ่มที่ติ๊กไว้ให้ (เจ้าของ 2 พ.ย. 2569) */
  const jobBu = jobBuOf(job);

  const [postings, setPostings] = React.useState<RecruitPosting[] | null>(null);
  const [opts, setOpts] = React.useState<SoOptions | null>(null);
  const [state, setState] = React.useState<{ latest: JobPostingRequest[]; recentGroups: string[] } | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [mode, setMode] = React.useState<SoPostMode>('caption_only');
  const [linkCode, setLinkCode] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [picked, setPicked] = React.useState<string[]>([]);
  /** กล่องเตือนในป๊อป — block = บัญชีที่เลือกไม่ได้ · info = เครื่องหลักออฟไลน์ · confirm = ถามก่อนส่ง */
  const [warn, setWarn] = React.useState<{ kind: 'block' | 'info' | 'confirm'; lines: string[] } | null>(null);
  /** เครื่องที่จะโพสต์ — ค่าเริ่ม = เครื่องหลักของบัญชี (เอกสารรอบ 2: พนักงานเลือกเองได้) */
  const [workerName, setWorkerName] = React.useState('');
  // ข้อความที่เคยแก้แล้วบันทึกไว้กับใบขอ = เปิดมาใช้ข้อความนั้น (เจ้าของ 28 ต.ค. 2569 "แก้ข้อความประกาศ ให้ไปแก้ที่ผู้สมัครจะเห็นแบบนี้ด้วย")
  const savedCaption = job.public_post_text?.trim() || null;
  const [caption, setCaption] = React.useState(savedCaption ?? '');
  const [captionEdited, setCaptionEdited] = React.useState(Boolean(savedCaption));
  /** บันทึกข้อความเฉพาะตอนคนพิมพ์/กดใช้ข้อความร่าง — เปิดดูเฉย ๆ ไม่เขียนฐาน (บทเรียน 27 ก.ย. ฟอร์มเซฟเองตอนเปิดดู) */
  const [captionDirty, setCaptionDirty] = React.useState<{ text: string | null } | null>(null);
  const [captionSave, setCaptionSave] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // ตัวรับจากหน้าแม่เป็นฟังก์ชันใหม่ทุกรอบวาด — เก็บใน ref ไม่งั้นบันทึกเสร็จแล้ววนบันทึกซ้ำ
  const onCaptionSavedRef = React.useRef(onCaptionSaved);
  onCaptionSavedRef.current = onCaptionSaved;
  React.useEffect(() => {
    if (!captionDirty) return;
    const requestNo = (job.request_no ?? '').trim();
    if (!requestNo) return;
    const pending = captionDirty;
    const t = window.setTimeout(() => {
      setCaptionSave('saving');
      saveUnitFieldOverridesPatch(requestNo, { post_caption: pending.text })
        .then(() => {
          setCaptionSave('saved');
          setCaptionDirty((cur) => (cur === pending ? null : cur));
          onCaptionSavedRef.current?.(pending.text);
        })
        .catch(() => setCaptionSave('error'));
    }, 900);
    return () => window.clearTimeout(t);
  }, [captionDirty, job.request_no]);
  const [busy, setBusy] = React.useState<'send' | 'link' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<JobPostingRequest | null>(null);

  React.useEffect(() => {
    let alive = true;
    Promise.all([fetchRecruitPostings({ jobId: job.id }), fetchSoOptions(), fetchJobPostingState(job.id)])
      .then(([p, o, s]) => {
        if (!alive) return;
        setPostings(p);
        setOpts(o);
        setState(s);
        const open = p.find((x) => x.status === 'open');
        const fb = open?.links.find((l) => /facebook/i.test(l.channelLabel ?? '')) ?? open?.links[0];
        if (fb) setLinkCode(fb.code);
        // บัญชีตั้งต้น = บัญชีธุรกิจเดียวกับใบขอ (เจ้าของ 2 พ.ย. 2569 "ตรงนี้ก็ต้องแยก Bu ด้วย") · ธุรกิจนี้ไม่มีบัญชี = ไม่เลือกให้
        const acc = firstAccount(soAccountsForJob(o.accounts, jobBu));
        if (acc) {
          setAccountId(acc.id);
          setWorkerName(acc.worker ?? '');
          if (acc.status === 'worker_offline') setWarn(offlineWarn(acc));
          setPicked(defaultSoGroupPick(soGroupsOfAccount(o, acc), jobBu, acc));
        }
      })
      .catch((e) => alive && setLoadError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่ได้'));
    return () => {
      alive = false;
    };
  }, [job.id, jobBu]);

  const openPosting = postings?.find((p) => p.status === 'open') ?? null;
  const links = openPosting?.links ?? [];
  const linkUrl = linkCode ? `${window.location.origin}${applyLinkPath(linkCode)}` : null;
  const account = opts?.accounts.find((a) => a.id === accountId) ?? null;
  const accountGroups = React.useMemo(
    // กลุ่มที่โพสต์ได้บ่อยใน 30 วันขึ้นก่อน (เอกสาร: ใช้ posted เป็นหลัก)
    () =>
      opts && account
        ? [...soGroupsOfAccount(opts, account)].sort(
            (a, b) => (b.stats30d?.posted ?? 0) - (a.stats30d?.posted ?? 0) || soGroupLabel(a).localeCompare(soGroupLabel(b), 'th'),
          )
        : [],
    [opts, account],
  );
  const sections = React.useMemo(() => soGroupSections(accountGroups, jobBu), [accountGroups, jobBu]);
  const postWorkers = opts ? soWorkersFor(opts, 'autopost') : [];
  const worker = postWorkers.find((w) => w.name === workerName) ?? null;
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
    ...(account && !soAccountSelectable(account.status) ? [soWarningText(account.name, account.status, account.warning)] : []),
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

  const pickAccount = (id: string) => {
    const a = opts?.accounts.find((x) => x.id === id);
    if (!opts || !a) return;
    // ถูกพัก / เครื่องออฟไลน์ / ยังไม่ผูกเครื่อง = เลือกไม่ได้ (เอกสาร So Scraping) — เตือนแล้วคงบัญชีเดิม
    if (!soAccountSelectable(a.status)) {
      setWarn({ kind: 'block', lines: [soWarningText(a.name, a.status, a.warning)] });
      return;
    }
    // เครื่องหลักออฟไลน์ = เลือกบัญชีได้ แต่ให้เลือกเครื่องอื่นที่ออนไลน์
    setWarn(a.status === 'worker_offline' ? offlineWarn(a) : null);
    setAccountId(id);
    setWorkerName(a.worker ?? '');
    setPicked(defaultSoGroupPick(soGroupsOfAccount(opts, a), jobBu, a));
  };

  const send = async (confirmed = false) => {
    if (busy || problems.length > 0 || !account || !linkUrl) return;
    const confirmLines = soPostConfirmWarnings(account, worker);
    if (!confirmed && confirmLines.length > 0) {
      setWarn({ kind: 'confirm', lines: confirmLines });
      return;
    }
    setWarn(null);
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
          // ไม่เปลี่ยนจากเครื่องหลัก = ไม่ส่ง ให้ So Scraping ใช้เครื่องหลักของบัญชี
          ...(workerName && workerName !== account.worker ? { worker: workerName } : {}),
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
      {embedded ? (
        <h3 className="text-base font-medium text-foreground">Autopost</h3>
      ) : (
        <DialogHeader>
          <DialogTitle>Autopost · {jobBoardCardTitle(job)}</DialogTitle>
          <DialogDescription>{publicJobTitle(job)}</DialogDescription>
        </DialogHeader>
      )}

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
          <SoStartLine requestId={sent.id} initial={sent.so_start} />
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
                    setCaptionDirty({ text: null });
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
                setCaptionDirty({ text: e.target.value });
              }}
              rows={14}
              data-testid="autopost-caption"
            />
            <p className={cn('flex justify-between gap-2 text-xs tabular-nums', DASH.muted)}>
              <span className={captionSave === 'error' ? TONE.danger.value : undefined} data-testid="autopost-caption-save">
                {captionSave === 'saving' ? 'กำลังบันทึก…' : captionSave === 'saved' ? 'บันทึกแล้ว · ขึ้นหน้าสมัครด้วย' : captionSave === 'error' ? 'บันทึกไม่สำเร็จ' : ''}
              </span>
              <span className={caption.length > AUTOPOST_CAPTION_MAX ? TONE.danger.value : undefined}>
                {NUM.format(caption.length)}/{NUM.format(AUTOPOST_CAPTION_MAX)}
              </span>
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
                  options={links.map((l) => {
                    // ผู้รับผิดชอบของลิงก์ = คนกดสร้าง (เจ้าของ 28 ต.ค. 2569 "บอกเพิ่มหน่อยว่าลิงก์นี้ใครรับผิดชอบ")
                    const owner = postingLinkOwner(l, openPosting);
                    return {
                      value: l.code,
                      label: `${l.channelLabel || 'ลิงก์ประกาศ'} · ${l.code}${owner ? ` · ${owner}` : ''}${l.applicationCount ? ` · สมัคร ${NUM.format(l.applicationCount)}` : ''}`,
                    };
                  })}
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
                {jobBu && soAccountsForJob(opts.accounts, jobBu).length === 0 ? (
                  <p className={cn('text-sm', TONE.warn.value)} data-testid="autopost-bu-no-account">
                    {soBuNoAccountText(jobBu)}
                  </p>
                ) : null}
                <FieldSelect
                  value={accountId}
                  onChange={pickAccount}
                  placeholder="เลือกบัญชี"
                  ariaLabel="บัญชี Facebook"
                  testId="autopost-account"
                  options={soAccountsByBu(opts.accounts, jobBu).map(({ account: a, group }) => ({
                    value: a.id,
                    label: `${a.name} · ${SO_ACCOUNT_STATUS_LABEL[a.status]} · โพสต์ ${NUM.format(a.postedToday)}${a.dailyCap !== null ? `/${NUM.format(a.dailyCap)}` : ''}`,
                    disabled: a.status === 'no_worker',
                    group,
                  }))}
                />
                {account ? (
                  <div className="space-y-0.5 text-xs" data-testid="autopost-account-status">
                    <p className="tabular-nums text-muted-foreground">
                      {[
                        `วันนี้โพสต์ ${NUM.format(account.postedToday)}${account.dailyCap !== null ? `/${NUM.format(account.dailyCap)}` : ''}`,
                        account.worker ? `เครื่องหลัก ${account.worker} ${account.workerOnline ? 'ออนไลน์' : 'ออฟไลน์'}` : 'ยังไม่ผูกเครื่อง',
                        account.queue.running + account.queue.queued > 0
                          ? `งานของบัญชีนี้ ${NUM.format(account.queue.running + account.queue.queued)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {account.warning ? <p className={TONE.warn.value}>{account.warning}</p> : null}
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium text-foreground">กลุ่ม Facebook</p>
            {!account ? null : accountGroups.length === 0 ? (
              <p className={cn('text-sm', TONE.warn.value)}>บัญชีนี้ยังไม่มีกลุ่ม ให้เพิ่มที่ระบบ So Scraping</p>
            ) : (
              <div className="space-y-2" data-testid="autopost-groups">
                {/* หมวดตามธุรกิจ (เจ้าของ 2 พ.ย. 2569): ธุรกิจของใบขอกางและติ๊กให้ครบ · ที่เหลือพับ ไม่ติ๊ก */}
                {jobBu && !sections.some((x) => x.forJob) ? (
                  <p className={cn('text-sm', TONE.warn.value)} data-testid="autopost-bu-empty">
                    {soBuEmptyText(jobBu)}
                  </p>
                ) : null}
                {!jobBu ? <p className={cn('text-sm', TONE.warn.value)}>ใบขอนี้ไม่ระบุธุรกิจ — เลือกกลุ่มเอง</p> : null}
                {sections.map((sec) => (
                  <GroupSection
                    key={sec.bu ?? '__none__'}
                    jobId={job.id}
                    section={sec}
                    account={account}
                    picked={picked}
                    recent={recent}
                    onToggle={(ids, on) => setPicked((prev) => (on ? [...new Set([...prev, ...ids])] : prev.filter((x) => !ids.includes(x))))}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium text-foreground">เครื่อง</p>
            {postWorkers.length === 0 ? (
              <p className={cn('text-sm', TONE.warn.value)}>ยังไม่มีเครื่องที่รับงานโพสต์</p>
            ) : (
              // สถานะเครื่องเป็นสี + คำเสมอ (So Scraping 28 ต.ค. 2569): ออนไลน์ = จุดเขียว · ออฟไลน์ = จุดเทา เลือกไม่ได้ · API เรียงออนไลน์ไว้บนให้แล้ว
              <Select
                value={workerName || undefined}
                onValueChange={(v) => {
                  setWorkerName(v);
                  if (warn?.kind !== 'block') setWarn(null);
                }}
              >
                <SelectTrigger className="h-10 text-sm" aria-label="เครื่อง" data-testid="autopost-worker">
                  <SelectValue placeholder="เลือกเครื่อง" />
                </SelectTrigger>
                <SelectContent>
                  {postWorkers.map((w) => {
                    const extra = [
                      `งานค้าง ${NUM.format(w.load)}`,
                      account && w.name === account.worker ? 'เครื่องหลัก' : null,
                      account && !soAccountOnWorker(account, w) ? 'ยังไม่เคยล็อกอินบัญชีนี้' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    const tone = w.online ? TONE.success : TONE.neutral;
                    return (
                      <SelectItem key={w.name} value={w.name} disabled={!w.online}>
                        <span className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} aria-hidden />
                          <span className="text-foreground">{w.name}</span>
                          <span className={cn('text-xs font-medium', tone.value)}>{w.online ? 'ออนไลน์' : 'ออฟไลน์'}</span>
                          <span className="text-xs text-muted-foreground">{extra}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
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

          {warn ? (
            <div
              role="alert"
              aria-label="คำเตือนจาก So Scraping"
              className={cn('space-y-2 rounded-xl border px-3 py-2', warn.kind === 'block' ? TONE.danger.soft : TONE.warn.soft)}
              data-testid="autopost-warn"
            >
              {warn.lines.map((l) => (
                <p key={l} className="text-sm text-foreground">
                  {l}
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                {warn.kind === 'confirm' ? (
                  <Button type="button" size="sm" onClick={() => void send(true)} disabled={busy !== null} data-testid="autopost-warn-confirm">
                    ส่งต่อ
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="outline" onClick={() => setWarn(null)}>
                  {warn.kind === 'confirm' ? 'กลับไปแก้' : 'ตกลง'}
                </Button>
              </div>
            </div>
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

/** บัญชีตั้งต้น = พร้อมโพสต์ก่อน แล้วมีงานค้าง แล้วครบโควต้า แล้วเครื่องหลักออฟไลน์ · ไม่มีที่เลือกได้ = ไม่เลือก */
/** เครื่องหลักออฟไลน์ — เลือกบัญชีได้ แต่บอกให้เปลี่ยนเครื่อง */
function offlineWarn(a: SoOptAccount): { kind: 'info'; lines: string[] } {
  return { kind: 'info', lines: [soWarningText(a.name, a.status, a.warning), 'เลือกเครื่องอื่นที่ออนไลน์ในช่องเครื่อง'] };
}

export function firstAccount(list: readonly SoOptAccount[]): SoOptAccount | null {
  for (const st of ['ready', 'busy', 'full', 'worker_offline'] as const) {
    const a = list.find((x) => x.status === st);
    if (a) return a;
  }
  return null;
}

/** หมวดกลุ่มตามธุรกิจ — ช่องติ๊กที่หัวเลือก/เอาออกทั้งหมวด · หมวดธุรกิจของใบขอเปิดอยู่ ที่เหลือพับ */
function GroupSection({
  jobId,
  section,
  account,
  picked,
  recent,
  onToggle,
}: {
  jobId: string;
  section: SoGroupSection;
  /** บัญชีที่เลือก — สถานะกลุ่มคิดจากบัญชีนี้ (สลับบัญชี = สถานะเปลี่ยน) */
  account: SoOptAccount | null;
  picked: readonly string[];
  recent: ReadonlySet<string>;
  onToggle: (ids: string[], on: boolean) => void;
}) {
  const [open, setOpen] = React.useState(section.forJob);
  const ids = section.groups.map((g) => g.id);
  const n = ids.filter((id) => picked.includes(id)).length;
  const headId = `autopost-bu-${jobId}-${section.bu ?? 'none'}`;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border/70" data-testid={`autopost-bu-${section.bu ?? 'none'}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <Checkbox
          id={headId}
          checked={n === 0 ? false : n === ids.length ? true : 'indeterminate'}
          onCheckedChange={(v) => onToggle(ids, v === true)}
          aria-label={`เลือกทุกกลุ่มของ ${section.label}`}
        />
        <Label htmlFor={headId} className="flex-1 text-sm font-medium tabular-nums text-foreground" data-testid="autopost-bu-head">
          {soSectionHeadText(section, picked, account)}
        </Label>
        <CollapsibleTrigger asChild>
          <Button type="button" size="xs" variant="ghost" aria-label={open ? `พับ ${section.label}` : `กาง ${section.label}`}>
            {open ? 'พับ' : 'กาง'}
            <ChevronDown className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <ul className="space-y-2 border-t border-border/70 px-3 py-2">
          {section.groups.map((g) => {
            // สถานะเป็นคำจาก So Scraping เสมอ (ไม่บอกด้วยสีอย่างเดียว) · ไม่ควรติ๊ก = ไม่ติ๊กให้ แต่ไม่ล็อก
            const view = soGroupView(g, account);
            return (
              <li key={g.id} className="flex items-start gap-2" data-testid="autopost-group-row">
                <Checkbox
                  id={`autopost-group-${jobId}-${g.id}`}
                  checked={picked.includes(g.id)}
                  onCheckedChange={(v) => onToggle([g.id], v === true)}
                  className="mt-0.5"
                />
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor={`autopost-group-${jobId}-${g.id}`} className="block text-sm font-normal text-foreground">
                    {soGroupLabel(g)}
                    <span className={cn('font-medium', view.recommended ? DASH.muted : TONE.warn.value)} data-testid="autopost-group-state">
                      {' — '}
                      {view.label}
                    </span>
                  </Label>
                  {view.detail || view.url ? (
                    <p className="flex flex-wrap items-center gap-x-2 text-xs">
                      {view.detail ? <span className={DASH.muted}>{view.detail}</span> : null}
                      {view.url ? (
                        <Button asChild type="button" size="xs" variant="link" className="h-auto p-0">
                          <a href={view.url} target="_blank" rel="noopener noreferrer" data-testid="autopost-group-open">
                            เปิดกลุ่ม
                          </a>
                        </Button>
                      ) : null}
                    </p>
                  ) : null}
                  <p className={cn('text-xs', DASH.muted)}>
                    {[
                      soGroupStatsText(g.stats30d),
                      g.lastPostedAt ? `โพสต์ล่าสุด ${WHEN.format(new Date(g.lastPostedAt))}` : null,
                      recent.has(g.id) ? 'ใบนี้เพิ่งสั่งโพสต์กลุ่มนี้ใน 3 วัน' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
