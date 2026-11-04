import React from 'react';
import { ChevronDown, LoaderCircle, Send } from 'lucide-react';
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
import { jobBoardCardTitle, jobUnitSectorOf } from '@/lib/unitRequestDisplay';
import { SoSectorFold } from '@/components/jobs/SoGroupPicker';
import type { UnitSector } from '@/lib/unitSector';
import { publicJobTitle } from '@/lib/publicJobTitle';
import { addPostingLink, createRecruitPosting, fetchRecruitPostings, searchRecruitChannels } from '@/lib/recruitPostingsApi';
import { jobPostingBody } from '@/lib/recruitPostingDraft';
import { releaseJobsToPublic } from '@/lib/jobPublicReleaseApi';
import { AUTOPOST_LINK_PLACEHOLDER } from '@/lib/postText';
import { saveUnitFieldOverridesPatch } from '@/lib/siamrajUnitRequestsApi';
import { applyLinkPath, recruitChannelLabel, type RecruitPosting, type RecruitPostingLink } from '@/lib/recruitPostings';
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
  isFacebookGroupChannel,
  soGroupLinkKey,
  soSectorBlocks,
  soSectorFoldOpen,
  soGroupLinkLabel,
  soGroupLinkName,
  soGroupLinkOf,
  type SoGroupLink,
  soGroupView,
  soSectionHeadText,
  soBuNoAccountText,
  soAccountsByBu,
  soAccountsForJob,
  soAccountChoice,
  soAccountStatusText,
  soAddWithinCap,
  soDefaultAccount,
  soDefaultWorker,
  soGroupCap,
  soNoAccountReadyText,
  soRepostWaitText,
  soWorkerOfflineText,
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
import OrderPostButton from '@/components/jobs/OrderPostButton';
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
        {job ? (
          <>
            <DialogHeader>
              <DialogTitle>Autopost / Scrap · {jobBoardCardTitle(job)}</DialogTitle>
              <DialogDescription>{publicJobTitle(job)}</DialogDescription>
            </DialogHeader>
            {/* ฟอร์มเดียวกับหน้าใบขอ/ป๊อปประกาศ (เจ้าของ 3 พ.ย. 2569 "ไม่ใช่แค่หน้านี้ หมายถึงหน้างานสรรหาด้วย") · ปุ่มบนการ์ดเปิดมาที่ Autopost */}
            <OrderPostButton key={job.id} job={job} defaultKind="autopost" onSent={onSent} />
          </>
        ) : null}
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
  /** ราชการ/เอกชนของใบขอ — ติ๊กกลุ่มให้เฉพาะประเภทเดียวกัน (4 พ.ย. 2569) */
  const jobSector = jobUnitSectorOf(job);

  const [postings, setPostings] = React.useState<RecruitPosting[] | null>(null);
  const [opts, setOpts] = React.useState<SoOptions | null>(null);
  const [state, setState] = React.useState<{ latest: JobPostingRequest[]; recentGroups: string[] } | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [mode, setMode] = React.useState<SoPostMode>('caption_only');
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
  const [busy, setBusy] = React.useState<'send' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<JobPostingRequest | null>(null);

  React.useEffect(() => {
    let alive = true;
    Promise.all([fetchRecruitPostings({ jobId: job.id }), fetchSoOptions(job.request_no), fetchJobPostingState(job.id)])
      .then(([p, o, s]) => {
        if (!alive) return;
        setPostings(p);
        setOpts(o);
        setState(s);
        const open = p.find((x) => x.status === 'open');
        // บัญชีตั้งต้น = บัญชีแรกที่ So Scraping แนะนำ (สเปค 6.1 · 3 พ.ย. 2569) ธุรกิจของใบขอก่อน · ไม่มี = ช่องว่าง + บอกเวลาที่ใช้ได้
        const acc = soDefaultAccount(o.accounts, jobBu);
        if (acc) {
          setAccountId(acc.id);
          // เครื่องตั้งต้น = เครื่องที่ So Scraping แนะนำ (ออนไลน์ คิวเบาสุด · สเปค 6.3) · ไม่มี = เครื่องหลักของบัญชี
          setWorkerName(soDefaultWorker(soWorkersFor(o, 'autopost'), 'post')?.name ?? acc.worker ?? '');
          setPicked(defaultSoGroupPick(soGroupsOfAccount(o, acc), jobBu, acc, jobSector));
        }
      })
      .catch((e) => alive && setLoadError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่ได้'));
    return () => {
      alive = false;
    };
  }, [job.id, job.request_no, jobBu, jobSector]);

  const openPosting = postings?.find((p) => p.status === 'open') ?? null;
  /**
   * ใบที่ยังไม่ประกาศ (เจ้าของ 3 พ.ย. 2569 Choice "ใช่ กด Autopost ทีเดียวจบ") — ข้อความใช้ตัวแทนลิงก์ไปก่อน
   * กดส่ง = ประกาศ + สร้างประกาศ/ลิงก์ให้ แล้วแทนตัวแทนด้วยลิงก์จริง (เปิดป๊อปดูเฉย ๆ ไม่เขียนฐาน)
   */
  /**
   * ไม่มีช่องเลือกลิงก์แล้ว (เจ้าของ 3 พ.ย. 2569 "ทำไมยังต้องเลือก … ฉันก็เลือกกลุ่มแล้วหนิ") — ข้อความใช้ตัวแทนลิงก์เสมอ
   * กดส่ง = แต่ละกลุ่มได้ลิงก์ของกลุ่ม (`ensureGroupLinks`) · apply_link กลางของใบสั่ง = ลิงก์ของกลุ่มแรก
   */
  const captionLink = AUTOPOST_LINK_PLACEHOLDER;
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
  /** ติ๊กกลุ่มได้ไม่เกินโพสต์ที่บัญชีเหลือวันนี้ (สเปค 6.2) — เกินแล้ว worker หยุดเองที่เพดาน กลุ่มที่เหลือไม่ได้โพสต์ */
  const cap = soGroupCap(account);
  const openOrder = state?.latest.find((r) => r.request_type === 'content' && soStatusView(r).open) ?? null;

  // แคปชั่นร่างใหม่ตามลิงก์ที่เลือก จนกว่าคนจะแก้เอง · แก้แล้ว = แทนเฉพาะลิงก์สมัครในข้อความ (syncCaptionLink)
  const draft = React.useMemo(() => buildAutopostCaption(job, { contact, link: captionLink }), [job, contact, captionLink]);
  React.useEffect(() => {
    if (!captionEdited) setCaption(draft);
    // ข้อความที่เคยแก้แล้วบันทึกไว้มีลิงก์ของรอบก่อน (3 พ.ย. 2569 รูปจากหน้างาน: ขึ้น "ข้อความต้องมีลิงก์สมัครที่เลือก" กดส่งไม่ได้)
    // ⇒ ลิงก์สมัครทุกอันในข้อความ = ลิงก์ที่เลือกอยู่เสมอ (รวมตัวแทนลิงก์)
    else setCaption((c) => syncCaptionLink(c, captionLink));
  }, [draft, captionLink, captionEdited]);

  // ลิงก์ไม่ต้องมีก่อนแล้ว — กดส่งสร้างให้ (ใบที่ข้อมูลขาดยังกดส่งไม่ได้ · เจ้าของ 3 พ.ย. 2569 Choice)
  const missing = autopostMissing(job, { hasLink: true });
  const leaks = captionLeaks(caption);
  const problems = [
    ...missing.map((m) => `ขาด${m}`),
    ...(account ? [] : ['เลือกบัญชี Facebook']),
    ...(account && !soAccountSelectable(account.status) ? [soWarningText(account.name, account.status, account.warning)] : []),
    ...(picked.length === 0 ? ['เลือกกลุ่มอย่างน้อย 1 กลุ่ม'] : []),
    ...(cap !== null && picked.length > cap ? [`เลือกกลุ่มได้ไม่เกิน ${NUM.format(cap)} กลุ่ม (โพสต์ที่บัญชีนี้เหลือวันนี้)`] : []),
    ...(mode !== 'image_only' && !caption.trim() ? ['ใส่ข้อความประกาศ'] : []),
    ...(mode !== 'image_only' && !caption.includes(captionLink) ? [`ข้อความต้องมี ${AUTOPOST_LINK_PLACEHOLDER}`] : []),
    ...leaks.map((l) => `ข้อความมี${l} — ลบออกก่อน`),
    ...(caption.length > AUTOPOST_CAPTION_MAX ? [`ข้อความยาวเกิน ${NUM.format(AUTOPOST_CAPTION_MAX)} ตัวอักษร`] : []),
  ];

  /**
   * ลิงก์ของแต่ละกลุ่มที่ติ๊ก (เจ้าของ 2 พ.ย. 2569 "อยากรู้ว่ากลุ่มไหนได้คนมาเยอะ" · Choice 1 ลิงก์ = 1 กลุ่ม)
   * ชื่อลิงก์ชุดเดียวกับ Gen link ("Facebook · Facebook Group · <ชื่อกลุ่ม>") — มีแล้วใช้ตัวเดิม ไม่มีค่อยสร้าง (สั่งซ้ำไม่งอกลิงก์)
   * 4 พ.ย. 2569 ลิงก์เดิมหาด้วยรหัสกลุ่ม (`soGroupLinkOf`) ไม่ใช่ชื่อ — กลุ่มชื่อซ้ำเคยได้ลิงก์เดียวกัน
   */
  const ensureGroupLinks = async (openPosting: RecruitPosting): Promise<SoGroupLink[]> => {
    if (!opts) throw new Error('โหลดข้อมูล So Scraping ไม่ได้');
    const matches = await searchRecruitChannels('Facebook Group', { limit: 20 });
    const fbGroup = matches.find((c) => isFacebookGroupChannel(c.name) && /^facebook$/i.test((c.parentName ?? '').trim())) ?? null;
    const channelLabel = fbGroup ? recruitChannelLabel(fbGroup) : 'Facebook · Facebook Group';
    const have: RecruitPostingLink[] = [...openPosting.links];
    const made: RecruitPostingLink[] = [];
    const out: SoGroupLink[] = [];
    for (const g of opts.groups.filter((x) => picked.includes(x.id))) {
      const label = soGroupLinkLabel(channelLabel, soGroupLinkName(g, opts.groups));
      let l = soGroupLinkOf(have, g, label);
      if (!l) {
        l = await addPostingLink(openPosting.id, { channelId: fbGroup?.id ?? null, channelLabel: label, fbGroupId: soGroupLinkKey(g) });
        made.push(l);
        have.push(l);
      }
      out.push({ group_id: g.id, link_code: l.code, apply_link: `${window.location.origin}${applyLinkPath(l.code)}` });
    }
    if (made.length) setPostings((prev) => (prev ?? []).map((p) => (p.id === openPosting.id ? { ...p, links: [...p.links, ...made] } : p)));
    return out;
  };

  const pickAccount = (id: string) => {
    const a = opts?.accounts.find((x) => x.id === id);
    if (!opts || !a) return;
    // ถูกพัก / ยังไม่ผูกเครื่อง = เลือกไม่ได้ (เอกสาร So Scraping) — เตือนแล้วคงบัญชีเดิม · ยังไม่ได้ล็อกอิน = เลือกได้ เตือนตอนกดส่ง
    if (!soAccountSelectable(a.status)) {
      setWarn({ kind: 'block', lines: [soWarningText(a.name, a.status, a.warning)] });
      return;
    }
    // เครื่องหลักออฟไลน์ = เลือกบัญชีได้ แต่ให้เลือกเครื่องอื่นที่ออนไลน์
    setWarn(a.status === 'worker_offline' ? offlineWarn(a) : null);
    setAccountId(id);
    setWorkerName(soDefaultWorker(soWorkersFor(opts, 'autopost'), 'post')?.name ?? a.worker ?? '');
    setPicked(defaultSoGroupPick(soGroupsOfAccount(opts, a), jobBu, a, jobSector));
  };

  const send = async (confirmed = false) => {
    if (busy || problems.length > 0 || !account) return;
    const confirmLines = soPostConfirmWarnings(account, worker, opts?.workers ?? []);
    if (!confirmed && confirmLines.length > 0) {
      setWarn({ kind: 'confirm', lines: confirmLines });
      return;
    }
    setWarn(null);
    setBusy('send');
    setError(null);
    try {
      // ใบที่ยังไม่ประกาศ = ประกาศ (ขึ้นหน้าสมัคร) + สร้างประกาศลิงก์กลาง ด้วยค่าตั้งต้นชุดเดียวกับป๊อป Gen link
      let posting = openPosting;
      if (!posting) {
        posting = await createRecruitPosting(jobPostingBody(job));
        await releaseJobsToPublic([job.id]);
        const created = posting;
        setPostings((prev) => [...(prev ?? []), created]);
      }
      const groupLinks = await ensureGroupLinks(posting);
      const first = groupLinks[0];
      if (!first) throw new Error('สร้างลิงก์สมัครไม่สำเร็จ');
      const applyLink = first.apply_link;
      const code = first.link_code;
      const finalCaption = caption.split(AUTOPOST_LINK_PLACEHOLDER).join(applyLink);
      const link = posting.links.find((l) => l.code === code);
      const item = await createJobPostingRequest({
        jobId: job.id,
        requestNo: job.request_no,
        reason: SO_POST_REASON,
        requestType: 'content',
        jobSnapshot: {
          ...soPostSnapshot({ ...composeJobSnapshot(job), position: publicJobTitle(job) }, { mode, caption: finalCaption, groupIds: picked }),
          account_id: account.id,
          account_name: account.name,
          // ไม่เปลี่ยนจากเครื่องหลัก = ไม่ส่ง ให้ So Scraping ใช้เครื่องหลักของบัญชี
          ...(workerName && workerName !== account.worker ? { worker: workerName } : {}),
          apply_link: applyLink,
          link_code: code,
          channel_label: link?.channelLabel ?? null,
          // ลิงก์กลุ่มละอัน — So Scraping แทน apply_link ใน caption ด้วยลิงก์ของกลุ่มตอนโพสต์ (เจ้าของ 2 พ.ย. 2569 "รอทำพร้อมกันทีเดียว")
          group_links: groupLinks,
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
      {embedded ? null : (
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

          {openPosting ? null : (
            <p className={cn('text-sm', TONE.warn.value)} data-testid="autopost-auto-release">
              ใบนี้ยังไม่ได้ประกาศ — กดส่งแล้วระบบประกาศและสร้างลิงก์ให้
            </p>
          )}

          <section className="space-y-2">
            <p className="text-sm font-medium text-foreground">1 · บัญชี Facebook</p>
            {opts.accounts.length === 0 ? (
              <p className={cn('text-sm', TONE.warn.value)}>ยังไม่มีบัญชี ให้เพิ่มที่ระบบ So Scraping</p>
            ) : (
              <>
                {jobBu && soAccountsForJob(opts.accounts, jobBu).length === 0 ? (
                  <p className={cn('text-sm', TONE.warn.value)} data-testid="autopost-bu-no-account">
                    {soBuNoAccountText(jobBu)}
                  </p>
                ) : null}
                {!opts.accounts.some((a) => a.recommended) ? (
                  <p className={cn('text-sm', TONE.danger.value)} data-testid="autopost-no-ready-account">
                    {soNoAccountReadyText(opts.accounts)}
                  </p>
                ) : null}
                <FieldSelect
                  value={accountId}
                  onChange={pickAccount}
                  placeholder="เลือกบัญชี"
                  ariaLabel="บัญชี Facebook"
                  testId="autopost-account"
                  options={soAccountsByBu(opts.accounts, jobBu).map(({ account: a, group }) => {
                    // คำสถานะ + สี (สเปค 6.1 · ห้ามใช้สีอย่างเดียว)
                    const c = soAccountChoice(a, opts.workers);
                    return { value: a.id, label: c.label, disabled: c.disabled, className: TONE[c.tone].value, group };
                  })}
                />
                {account ? (
                  <div className="space-y-0.5 text-xs" data-testid="autopost-account-status">
                    <p className={cn('font-medium', TONE[soAccountStatusText(account).tone].value)}>{soAccountStatusText(account).text}</p>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">2 · กลุ่ม Facebook</p>
              {account && cap !== null ? (
                <span className={cn('text-xs tabular-nums', picked.length > cap ? TONE.danger.value : DASH.muted)} data-testid="autopost-group-count">
                  เลือกแล้ว {NUM.format(picked.length)}/{NUM.format(cap)}
                </span>
              ) : null}
            </div>
            {account && cap === 0 ? (
              <p className={cn('text-sm', TONE.warn.value)} data-testid="autopost-cap-zero">
                บัญชีนี้ไม่เหลือโพสต์วันนี้ ติ๊กกลุ่มไม่ได้ — เลือกบัญชีอื่น
              </p>
            ) : null}
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
                    allGroups={opts?.groups ?? []}
                    jobSector={jobSector}
                    account={account}
                    picked={picked}
                    recent={recent}
                    cap={cap}
                    onToggle={(ids, on) => setPicked((prev) => (on ? soAddWithinCap(prev, ids, cap) : prev.filter((x) => !ids.includes(x))))}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium text-foreground">3 · เครื่อง</p>
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
                          <span className={cn('text-xs font-medium', tone.value)}>{w.online ? 'ออนไลน์' : soWorkerOfflineText(w)}</span>
                          <span className="text-xs text-muted-foreground">{extra}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </section>

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

/** แทนลิงก์สมัคร (…/apply/p/<รหัส>) และตัวแทนลิงก์ทุกอันในข้อความด้วยลิงก์ที่เลือก */
export function syncCaptionLink(caption: string, link: string): string {
  return caption
    .replace(/https?:\/\/[^\s]*\/apply\/p\/[A-Za-z0-9]+/g, link)
    .split(AUTOPOST_LINK_PLACEHOLDER)
    .join(link);
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
  allGroups,
  jobSector,
  account,
  picked,
  recent,
  cap,
  onToggle,
}: {
  jobId: string;
  section: SoGroupSection;
  /** ทุกกลุ่ม — ชื่อซ้ำต่อท้ายรหัสกลุ่ม ตรงกับชื่อบนลิงก์ */
  allGroups: readonly SoOptGroup[];
  /** ราชการ/เอกชนของใบขอ — หัวข้อย่อยประเภทเดียวกับใบขอขึ้นก่อน */
  jobSector: UnitSector | null;
  /** ติ๊กได้สูงสุด (โพสต์ที่บัญชีเหลือวันนี้) · null = ไม่จำกัด */
  cap: number | null;
  /** บัญชีที่เลือก — สถานะกลุ่มคิดจากบัญชีนี้ (สลับบัญชี = สถานะเปลี่ยน) */
  account: SoOptAccount | null;
  picked: readonly string[];
  recent: ReadonlySet<string>;
  onToggle: (ids: string[], on: boolean) => void;
}) {
  const [open, setOpen] = React.useState(section.forJob);
  /** ติ๊กครบเพดานแล้ว — ช่องที่ยังไม่ติ๊กเป็นสีเทา กดไม่ได้ (เอาออกได้เสมอ) */
  const full = cap !== null && picked.length >= cap;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border/70" data-testid={`autopost-bu-${section.bu ?? 'none'}`}>
      {/* ช่องติ๊กทั้งหมดย้ายไปหัวข้อย่อย ราชการ / เอกชน (เจ้าของ 4 พ.ย. 2569 · ติ๊กหัวธุรกิจเดียวได้ 2,437 กลุ่ม) */}
      <div className="flex items-center gap-2 px-3 py-2">
        <p className="flex-1 text-sm font-medium tabular-nums text-foreground" data-testid="autopost-bu-head">
          {soSectionHeadText(section, picked, account)}
        </p>
        <CollapsibleTrigger asChild>
          <Button type="button" size="xs" variant="ghost" aria-label={open ? `พับ ${section.label}` : `กาง ${section.label}`}>
            {open ? 'พับ' : 'กาง'}
            <ChevronDown className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="space-y-3 border-t border-border/70 px-3 py-2">
          {/* แยก ราชการ / เอกชน ในหมวดธุรกิจ (เจ้าของ 4 พ.ย. 2569) */}
          {soSectorBlocks(section.groups, jobSector).map((block, i) => (
            <SoSectorFold
              key={block.sector ?? 'none'}
              label={block.label}
              ids={block.groups.map((g) => g.id)}
              picked={picked}
              onToggle={onToggle}
              checkId={`autopost-sector-${jobId}-${section.bu ?? 'none'}-${block.sector ?? 'none'}`}
              defaultOpen={soSectorFoldOpen(block.sector, jobSector, i)}
              testId={`autopost-sector-${block.sector ?? 'none'}`}
            >
              <ul className="space-y-2">
          {block.groups.map((g) => {
            // สถานะเป็นคำจาก So Scraping เสมอ (ไม่บอกด้วยสีอย่างเดียว) · ไม่ควรติ๊ก = ไม่ติ๊กให้ แต่ไม่ล็อก
            const view = soGroupView(g, account);
            return (
              // ติ๊กครบเพดานแล้ว = แถวที่ยังไม่ติ๊กเป็นสีเทา (สเปค 6.2)
              <li
                key={g.id}
                className={cn('flex items-start gap-2', full && !picked.includes(g.id) && 'opacity-50')}
                data-testid="autopost-group-row"
              >
                <Checkbox
                  id={`autopost-group-${jobId}-${g.id}`}
                  checked={picked.includes(g.id)}
                  disabled={full && !picked.includes(g.id)}
                  onCheckedChange={(v) => onToggle([g.id], v === true)}
                  className="mt-0.5"
                />
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor={`autopost-group-${jobId}-${g.id}`} className="block text-sm font-normal text-foreground">
                    {soGroupLabel(g, allGroups)}
                    <span className={cn('font-medium', view.recommended ? DASH.muted : TONE.warn.value)} data-testid="autopost-group-state">
                      {' — '}
                      {view.label}
                    </span>
                  </Label>
                  {g.repostWait ? (
                    // ใบนี้เพิ่งลงกลุ่มนี้ไม่ถึง 2 วัน (สเปค 6.2) — ไม่ติ๊กให้ · ติ๊กเองได้แต่รอบนี้ So Scraping จะข้าม
                    <p className={cn('text-xs', DASH.muted)} data-testid="autopost-group-repost-wait">
                      {soRepostWaitText(g.repostWait)}
                    </p>
                  ) : null}
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
                      !g.repostWait && recent.has(g.id) ? 'ใบนี้เพิ่งสั่งโพสต์กลุ่มนี้ใน 3 วัน' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </li>
            );
          })}
              </ul>
            </SoSectorFold>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
