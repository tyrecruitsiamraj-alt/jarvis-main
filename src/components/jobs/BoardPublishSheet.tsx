/**
 * ═══ ป๊อปประกาศ "หน้าเดียว" ของกล่องงาน (เจ้าของเลือก B 2 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"กล่องงานอะ มันดูงงๆ ขอแนวทางที่ดีกว่านี้"* → Choice **"B ป๊อปหน้าเดียว ระบบร่างให้ (แนะนำ)"**
 * วัดจริงก่อนรื้อ: ใบเปิด 346 · ประกาศแล้ว 6 · "ติดขั้น 1" 193 · "ขั้น 2" 122 · มีลิงก์รอกด 21 · ไม่มีใครใส่อำเภอเอง 337/340
 * ⇒ ขั้น 1-4 ต่อใบ × 340 ใบคือกำแพง · ของที่ ERP มีอยู่แล้ว (ที่อยู่ · อัตรา · เพศ) ควรขึ้นให้ก่อน คนแค่ตรวจแล้วกด
 *
 * หน้าเดียวมี 3 ส่วน (ไม่มีเลขขั้น ไม่มี "ถัดไป"):
 *   ซ้าย  **คนนอกจะเห็นแบบนี้** — การ์ดหน้าสมัครสาธารณะตัวจริง (`PublicJobCardPreview`) · ดูใบขอทั้งใบ/คนเก่า พับไว้
 *   ขวา   **ของที่จะขึ้นประกาศ** — สถานที่ · รายได้ · สวัสดิการ · เพศที่รับ · ให้ผู้สมัครเห็นอะไรบ้าง
 *         แต่ละแถว = ค่าที่ขึ้นจริงตอนนี้ + ป้ายว่ามาจากใบขอหรือตั้งเอง · ช่องที่ **ขาด** ขึ้นสีเหลือง และกางช่องให้เติมเอง
 *         ตัวแก้ = ฟอร์มเดิมทุกตัว (`EditPublicJobFieldsDialog` ทีละส่วน · `GenderPicker`) — ไม่มีฟอร์มใหม่
 *   ล่าง  ลิงก์สมัคร (ไม่บังคับ — Choice 30 ก.ย. 2569) · "ไม่ประกาศใบนี้" · **เก็บร่าง** / **ประกาศ** ปุ่มเดียว
 *
 * 🔴 ที่คงจากป๊อปเดิม: ประกาศทีละใบ (ไม่มีส่งเป็นชุด — 26 ก.ย. 2569) · ใบขอไม่ระบุเพศ = กดประกาศไม่ได้ (26 ก.ย.) ·
 *    ตั้งไม่ประกาศไว้ = ส่งไม่ได้ · ประกาศแล้วมีปุ่ม "ดึงประกาศลง" ทันทีที่เปิด (29 ก.ย.) · แท็บ **รายชื่อ** แยกจากตรวจสอบ (21 ก.ย.) ·
 *    ห้ามซ้อน Dialog (ทุกฟอร์มฝังในหน้า) · ไม่มีเครื่องหมายถูก · ห้ามพาออกนอกกล่องงาน
 * 🔴 **กางตัวแก้ได้ทีละช่อง** — ฟอร์มสถานที่/รายได้/สวัสดิการบันทึกเองเมื่อค่าต่างจากใบขอ ถ้ากางพร้อมกันสองฟอร์มที่ถือช่องเดียวกัน
 *    (เช่น "ให้ผู้สมัครเห็นอะไรบ้าง") ฟอร์มที่ค้างค่าเก่าจะเขียนทับกลับ (บทเรียน 27/30 ก.ย. 2569)
 * ทางถอย: ป๊อป 4 ขั้นเดิม (`BoardPostingSteps`) ยังอยู่ครบ เรียกได้ที่ `/jobs/board?popup=steps`
 */
import React from 'react';
import { ChevronDown, ClipboardCheck, Send, UserMinus, Users } from 'lucide-react';

import EditPostingDialog from '@/components/jobs/EditPostingDialog';
import EditPublicJobFieldsDialog from '@/components/jobs/EditPublicJobFieldsDialog';
import GenApplyLinkDialog from '@/components/jobs/GenApplyLinkDialog';
import GenderPicker from '@/components/jobs/GenderPicker';
import JobApplicantsDialog from '@/components/jobs/JobApplicantsDialog';
import PublicJobCardPreview from '@/components/jobs/PublicJobCardPreview';
import PublishReadinessChip from '@/components/jobs/PublishReadinessChip';
import ReleaseSkipControl from '@/components/jobs/ReleaseSkipControl';
import UnitRequestInfoFields from '@/components/jobs/UnitRequestInfoFields';
import { RequestRateLinesBlock, ResignedEmployeeBlock } from '@/components/jobs/UnitRequestPayBlocks';
import { StepCard } from '@/components/jobs/postingStepParts';
import { useJobPublishRegistry } from '@/components/jobs/useJobPublishRegistry';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { releaseJobsToPublic, unreleaseJobsFromPublic } from '@/lib/jobPublicReleaseApi';
import { releaseSkipText } from '@/lib/jobReleaseSkips';
import { erpGenderLabel, genderNeedsChoice, onlineGenderChoice } from '@/lib/genderRequirement';
import { publicSafeAddress } from '@/lib/publicJobPrivacy';
import { PUBLIC_FIELD_LABEL, PUBLIC_TOGGLE_FIELDS, publicFieldVisible } from '@/lib/publicFieldVisibility';
import { benefitDisplayLabels } from '@/lib/extraBenefits';
import { publicIncomeOf, publishGapsOf, publishReadinessOf, type PublishGapKey } from '@/lib/publishReadiness';
import { SEARCH_ALL_POOLS_AND_CALL } from '@/lib/candidateSearchLabels';
import { EVEN_TYPE, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';

const NUM = new Intl.NumberFormat('th-TH');

/** แถวในการ์ด "ของที่จะขึ้นประกาศ" — เพศกับ "ให้ผู้สมัครเห็น" ไม่ใช่ช่องที่ขาดได้แบบเดียวกัน แต่อยู่รายการเดียวกัน */
type FieldKey = PublishGapKey | 'benefits' | 'visibility';

/** ใบนี้มีข้อมูลคนเก่าให้ดูไหม — ใบเปิดไซต์ใหม่ไม่มีคนเก่า (ไม่ต้องวาดกล่องที่มีแต่ "—") */
function hasResignedInfo(job: JobRequest): boolean {
  return Boolean(
    job.resigned_employee_name?.trim() ||
      job.resigned_reason?.trim() ||
      job.resigned_wage_fee_rate != null ||
      job.resigned_wage_draw_rate != null ||
      (job.resigned_income_3m && job.resigned_income_3m.length > 0),
  );
}

function Loading({ text = 'กำลังโหลดใบขอ…' }: { text?: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

/**
 * หนึ่งช่องที่จะขึ้นประกาศ — ค่าที่ขึ้นจริง · ที่มา · ปุ่มกาง/ปิดตัวแก้
 * ช่องที่ขาดเป็นสีเหลืองทั้งแถว (ภาษาสีเดียวกับ "เหลือหา") · ตัวแก้วาดเฉพาะตอนกาง (ดูเหตุผลที่หัวไฟล์)
 */
function FieldRow({
  id,
  label,
  value,
  source,
  gap = false,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  value: React.ReactNode;
  /** "ตามใบขอ" / "ตั้งเอง" — ให้รู้ว่าเลขนี้ระบบร่างให้หรือคนตั้ง */
  source: string;
  gap?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-xl border p-3', gap ? TONE.warn.soft : 'border-border')} data-field={id} data-gap={gap || undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
        <span className={cn('min-w-0 flex-1 break-words text-sm', gap ? TONE.warn.value : 'text-foreground')}>{value}</span>
        <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{source}</span>
        <Button
          type="button"
          size="xs"
          variant={open ? 'default' : 'outline'}
          aria-expanded={open}
          aria-controls={`${id}-editor`}
          aria-label={`${open ? 'ปิด' : gap ? 'เติม' : 'แก้'}${label}`}
          onClick={onToggle}
        >
          {open ? 'ปิด' : gap ? 'เติม' : 'แก้'}
        </Button>
      </div>
      {open ? (
        <div id={`${id}-editor`} className="mt-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export type BoardPublishSheetProps = {
  /** เลขที่ใบ / id ของใบขอ */
  id: string;
  /** จบงาน (เก็บร่าง / ประกาศแล้ว / ปิด) = ปิดป๊อปกลับกล่องงาน — 🔴 ห้ามพาไปหน้าอื่น */
  onDone: () => void;
  /** ปุ่ม "หาคนทุกกอง + ให้ AI โทร" บนแท็บรายชื่อ — ไม่ส่ง = ไม่มีปุ่ม (ใบปิด/ยกเลิก) */
  onSearchAllPools?: () => void;
};

export const BoardPublishSheet: React.FC<BoardPublishSheetProps> = ({ id, onDone, onSearchAllPools }) => {
  const reg = useJobPublishRegistry(id);
  const { job, error, latestPosting, linkCount, released, skip } = reg;

  const [view, setView] = React.useState<'review' | 'people'>('review');
  /** ค่าที่เพิ่งแก้ — ทับบนใบทันทีโดยไม่ต้องโหลดใบใหม่ (ตัวอย่างซ้ายเปลี่ยนตาม) */
  const [publicPatch, setPublicPatch] = React.useState<Partial<JobRequest>>({});
  const [openField, setOpenField] = React.useState<FieldKey | null>(null);
  const [autoOpened, setAutoOpened] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [resignedOpen, setResignedOpen] = React.useState(false);
  const [wantLink, setWantLink] = React.useState(false);
  const [editPostingOpen, setEditPostingOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);

  const jobWithPatch = job ? ({ ...job, ...publicPatch } as JobRequest) : null;
  const gaps = jobWithPatch ? publishGapsOf(jobWithPatch) : [];
  /** 🔴 ใบขอไม่ระบุเพศและยังไม่มีใครเลือก = ประกาศไม่ได้ (เจ้าของเคาะ 26 ก.ย. 2569) */
  const genderBlocked = jobWithPatch ? genderNeedsChoice(jobWithPatch) : false;
  const readiness =
    jobWithPatch && released !== null && skip !== undefined
      ? publishReadinessOf(jobWithPatch, { isReleased: () => released, isSkipped: () => Boolean(skip) })
      : null;

  // เปิดมาแล้วกางช่องแรกที่ขาดให้เลย (ครั้งเดียวต่อใบ) — "เติมเฉพาะที่ขาด"
  React.useEffect(() => {
    if (autoOpened || !job || released === null || skip === undefined) return;
    setAutoOpened(true);
    if (!released && !skip) {
      const first = publishGapsOf(job)[0];
      if (first) setOpenField(first);
    }
  }, [autoOpened, job, released, skip]);

  const onFieldsSaved = (patch: Partial<JobRequest>) => setPublicPatch((prev) => ({ ...prev, ...patch }));
  const toggleField = (k: FieldKey) => setOpenField((cur) => (cur === k ? null : k));

  const toggleRelease = async (next: boolean) => {
    if (!job) return;
    setBusy(true);
    setSendError(null);
    try {
      if (next) await releaseJobsToPublic([job.id]);
      else await unreleaseJobsFromPublic([job.id]);
      await reg.loadReleases();
      if (next) onDone();
    } catch (e) {
      setSendError(e instanceof Error && e.message ? e.message : next ? 'ประกาศไม่สำเร็จ ลองอีกครั้ง' : 'ดึงประกาศลงไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setBusy(false);
    }
  };

  // ── ค่าที่ขึ้นจริงตอนนี้ของแต่ละแถว ──
  const placeText = jobWithPatch ? publicSafeAddress(jobWithPatch) : '';
  const placeManual = Boolean(
    jobWithPatch && (jobWithPatch.override_province || jobWithPatch.override_district || jobWithPatch.override_subdistrict),
  );
  const income = jobWithPatch ? publicIncomeOf(jobWithPatch) : null;
  const extraBenefits = jobWithPatch ? benefitDisplayLabels(jobWithPatch.extra_benefits) : [];
  const erpBenefits = jobWithPatch?.benefits ?? [];
  const genderChosen = jobWithPatch ? onlineGenderChoice(jobWithPatch) : null;
  const genderErp = jobWithPatch ? erpGenderLabel(jobWithPatch) : null;
  const genderText = genderChosen ?? (genderErp === 'ชาย' || genderErp === 'หญิง' ? genderErp : null);
  const hiddenFields = jobWithPatch ? PUBLIC_TOGGLE_FIELDS.filter((f) => !publicFieldVisible(jobWithPatch, f)) : [];

  return (
    <div className={cn('relative', EVEN_TYPE)}>
      <div className="space-y-4 py-1">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Tabs value={view} onValueChange={(v) => setView(v as 'review' | 'people')}>
          <TabsList className="w-full">
            <TabsTrigger value="review" className="flex-1">
              <ClipboardCheck aria-hidden /> ตรวจสอบ
            </TabsTrigger>
            <TabsTrigger value="people" className="flex-1">
              <Users aria-hidden /> รายชื่อ
            </TabsTrigger>
          </TabsList>

          <TabsContent value="people" className="mt-4 space-y-3">
            {onSearchAllPools ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                title={SEARCH_ALL_POOLS_AND_CALL.hint}
                onClick={onSearchAllPools}
                className={TONE.success.outline}
              >
                <Send aria-hidden />
                {SEARCH_ALL_POOLS_AND_CALL.label}
              </Button>
            ) : null}
            {job ? <JobApplicantsDialog embedded open job={job} onClose={() => undefined} /> : <Loading />}
          </TabsContent>

          <TabsContent value="review" className="mt-4 space-y-4">
            {/* ── สภาพของใบ — บรรทัดเดียว ── */}
            <div className="flex flex-wrap items-center gap-2" data-testid="publish-status">
              {released ? (
                <>
                  <span className={cn('rounded-full border px-3 py-1 text-xs', TONE.success.soft, TONE.success.value)}>✓ ประกาศแล้ว</span>
                  <Button type="button" size="xs" variant="outline" disabled={busy || !job} onClick={() => void toggleRelease(false)}>
                    {busy ? 'กำลังบันทึก…' : 'ดึงประกาศลง'}
                  </Button>
                </>
              ) : skip ? (
                <span className={cn('rounded-full border px-3 py-1 text-xs', TONE.danger.soft, TONE.danger.value)}>
                  ตั้งไม่ประกาศไว้ · {releaseSkipText(skip)}
                </span>
              ) : readiness ? (
                <PublishReadinessChip readiness={readiness} />
              ) : (
                <Loading text="กำลังอ่านทะเบียนการประกาศ…" />
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              {/* ── ซ้าย: คนนอกจะเห็นแบบนี้ ── */}
              <StepCard title="คนนอกจะเห็นแบบนี้">
                {jobWithPatch ? <PublicJobCardPreview job={jobWithPatch} /> : <Loading />}
                {job ? (
                  <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="xs" className="-ml-2">
                        {infoOpen ? 'ย่อใบขอ' : 'ดูใบขอทั้งใบ'}
                        <ChevronDown className={cn('transition-transform', infoOpen && 'rotate-180')} aria-hidden />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-3">
                      <UnitRequestInfoFields job={job} />
                      <RequestRateLinesBlock job={job} />
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
                {job && hasResignedInfo(job) ? (
                  <Collapsible open={resignedOpen} onOpenChange={setResignedOpen}>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="xs" className="-ml-2">
                        <UserMinus aria-hidden />
                        คนเก่า + รายได้ย้อนหลัง
                        <ChevronDown className={cn('transition-transform', resignedOpen && 'rotate-180')} aria-hidden />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <ResignedEmployeeBlock job={job} compact />
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </StepCard>

              {/* ── ขวา: ของที่จะขึ้นประกาศ — เติมเฉพาะที่ขาด ── */}
              <StepCard
                title="ของที่จะขึ้นประกาศ"
                aside={
                  gaps.length > 0 ? (
                    <span className={cn('text-xs', TONE.warn.value)}>ขาด {NUM.format(gaps.length)} ช่อง</span>
                  ) : jobWithPatch ? (
                    <span className={cn('text-xs', TONE.success.value)}>ครบ</span>
                  ) : null
                }
              >
                {jobWithPatch ? (
                  <div className="space-y-2">
                    <FieldRow
                      id="place"
                      label="สถานที่"
                      value={placeText || 'ยังไม่รู้จังหวัด'}
                      source={placeManual ? 'ตั้งเอง' : 'ตามใบขอ'}
                      gap={gaps.includes('place')}
                      open={openField === 'place'}
                      onToggle={() => toggleField('place')}
                    >
                      <EditPublicJobFieldsDialog key={`${jobWithPatch.id}-place`} sections={['place']} job={jobWithPatch} onSaved={onFieldsSaved} />
                    </FieldRow>
                    <FieldRow
                      id="income"
                      label="รายได้"
                      value={income ? (income.unit ? income.text : `${income.text} (ยังไม่บอกหน่วย)`) : 'ยังไม่มีรายได้ให้เห็น'}
                      source={income?.manual ? 'ตั้งเอง' : 'ตามใบขอ'}
                      gap={gaps.includes('income')}
                      open={openField === 'income'}
                      onToggle={() => toggleField('income')}
                    >
                      <EditPublicJobFieldsDialog
                        key={`${jobWithPatch.id}-income`}
                        sections={['income']}
                        hideVisibility
                        job={jobWithPatch}
                        onSaved={onFieldsSaved}
                      />
                    </FieldRow>
                    <FieldRow
                      id="benefits"
                      label="สวัสดิการ"
                      value={
                        extraBenefits.length > 0
                          ? extraBenefits.join(' · ')
                          : erpBenefits.length > 0
                            ? `ตามอัตราใบขอ ${NUM.format(erpBenefits.length)} รายการ`
                            : 'ยังไม่ได้เลือก'
                      }
                      source={extraBenefits.length > 0 ? 'ตั้งเอง' : 'ตามใบขอ'}
                      open={openField === 'benefits'}
                      onToggle={() => toggleField('benefits')}
                    >
                      <EditPublicJobFieldsDialog
                        key={`${jobWithPatch.id}-benefits`}
                        sections={['benefits']}
                        hideVisibility
                        job={jobWithPatch}
                        onSaved={onFieldsSaved}
                      />
                    </FieldRow>
                    <FieldRow
                      id="gender"
                      label="เพศที่รับ"
                      value={genderText ?? 'ยังไม่ได้เลือก'}
                      source={genderChosen ? 'ตั้งเอง' : 'ตามใบขอ'}
                      gap={gaps.includes('gender')}
                      open={openField === 'gender'}
                      onToggle={() => toggleField('gender')}
                    >
                      <GenderPicker job={jobWithPatch} onSaved={onFieldsSaved} />
                    </FieldRow>
                    <FieldRow
                      id="visibility"
                      label="ให้เห็น"
                      value={hiddenFields.length === 0 ? 'ทุกช่อง' : `ซ่อน ${hiddenFields.map((f) => PUBLIC_FIELD_LABEL[f]).join(' · ')}`}
                      source={hiddenFields.length === 0 ? 'ตามใบขอ' : 'ตั้งเอง'}
                      open={openField === 'visibility'}
                      onToggle={() => toggleField('visibility')}
                    >
                      <EditPublicJobFieldsDialog
                        key={`${jobWithPatch.id}-visibility`}
                        sections={['visibility']}
                        job={jobWithPatch}
                        onSaved={onFieldsSaved}
                      />
                    </FieldRow>
                  </div>
                ) : (
                  <Loading />
                )}
              </StepCard>
            </div>

            {/* ── ลิงก์สมัคร (ไม่บังคับ — Choice 30 ก.ย. 2569) ── */}
            <StepCard title="ลิงก์สมัคร" aside={<span className="text-xs text-muted-foreground">ไม่บังคับ</span>}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <p className="text-sm text-foreground">
                  {linkCount === null ? 'กำลังโหลด…' : linkCount > 0 ? `มีแล้ว ${NUM.format(linkCount)} ลิงก์` : 'ยังไม่มีลิงก์'}
                </p>
                <label htmlFor="publish-want-link" className="flex w-fit cursor-pointer items-center gap-3">
                  <Checkbox id="publish-want-link" checked={wantLink} onCheckedChange={(v) => setWantLink(v === true)} />
                  <span className="text-sm text-foreground">{linkCount ? 'สร้างลิงก์เพิ่ม' : 'สร้างลิงก์'}</span>
                </label>
              </div>
              {wantLink && job ? (
                <GenApplyLinkDialog
                  embedded
                  open
                  previewFirst
                  job={job}
                  onClose={() => setWantLink(false)}
                  onCreated={() => void reg.loadPostings()}
                />
              ) : null}
              {latestPosting ? (
                <Collapsible open={editPostingOpen} onOpenChange={setEditPostingOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="xs">
                      แก้ข้อความประกาศ
                      <ChevronDown className={cn('transition-transform', editPostingOpen && 'rotate-180')} aria-hidden />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <EditPostingDialog
                      embedded
                      posting={latestPosting}
                      onClose={() => setEditPostingOpen(false)}
                      onSaved={() => void reg.loadPostings()}
                    />
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </StepCard>

            {/* ── ด่านที่กันกดประกาศ — บอกตรง ๆ พร้อมปุ่มพาไปช่องนั้น ── */}
            {!released && skip ? (
              <p className={cn('rounded-xl border px-3 py-2 text-sm', TONE.danger.soft, TONE.danger.value)}>
                ใบนี้ตั้งไม่ประกาศไว้ ยกเลิกข้างล่างก่อนถึงจะประกาศได้
              </p>
            ) : null}
            {!released && !skip && genderBlocked ? (
              <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2', TONE.warn.soft)}>
                <p className={cn('text-sm', TONE.warn.value)}>ใบขอไม่ระบุเพศ เลือกเพศก่อนถึงจะประกาศได้</p>
                <Button type="button" size="xs" variant="outline" onClick={() => setOpenField('gender')}>
                  ไปเลือกเพศ
                </Button>
              </div>
            ) : null}

            {/* ── ท้าย: ไม่ประกาศใบนี้ (ซ้าย) · เก็บร่าง / ประกาศ (ขวา) ── */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              {job ? (
                <ReleaseSkipControl jobId={job.id} skip={skip} released={released} onChanged={() => void reg.loadSkips()} />
              ) : (
                <span />
              )}
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {sendError ? <p className="text-xs text-destructive">{sendError}</p> : null}
                {released === null ? (
                  <Loading text="กำลังอ่านทะเบียนการประกาศ…" />
                ) : released ? (
                  <Button type="button" onClick={onDone}>
                    ปิด
                  </Button>
                ) : (
                  <>
                    {/* ร่าง = ของที่แก้ไว้บันทึกแล้วทุกช่อง ยังไม่ประกาศ ⇒ ปิดป๊อปกลับกล่องงาน */}
                    <Button type="button" variant="outline" disabled={busy} title="เก็บที่ทำไว้ ยังไม่ประกาศ" onClick={onDone}>
                      เก็บร่าง
                    </Button>
                    <Button type="button" disabled={busy || !job || genderBlocked || Boolean(skip)} onClick={() => void toggleRelease(true)}>
                      {busy ? 'กำลังประกาศ…' : 'ประกาศ'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BoardPublishSheet;
