import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ApplicantAttachmentPanel from '@/components/recruit-rm/ApplicantAttachmentPanel';
import ApplicantInfoPanel from '@/components/recruit-rm/ApplicantInfoPanel';
import ApplicantPhoneFix from '@/components/recruit-rm/ApplicantPhoneFix';
import { CallsTable, HistoryTable } from '@/components/recruit-rm/ApplicantRecordTables';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { EM_DASH } from '@/lib/displayFallback';
import {
  APPLICATION_ORIGIN_LABEL,
  fetchApplicantDetailExtras,
  updateApplicationProfile,
  type ApplicantDetailExtras,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import { applicationJobLabel, daysSinceApplied } from '@/lib/recruitRm';
import { detailCallRows } from '@/lib/applicantDetail';
import {
  PROFILE_GENDER_LABEL,
  profileDraftOf,
  profilePatchFromDraft,
  type ProfileDraft,
  type ProfileGender,
} from '@/lib/applicantProfileEdit';

/**
 * ═══ ใบประวัติผู้สมัคร — ปุ่ม "ดูรายละเอียด" ของแท็บผู้สมัคร (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"หน้า ผู้สมัครตอนจะดูรายละเอียดกดไปก็ต้องขึ้นประวัติเข้าเลยดิ่ ตอนนี้ขึ้นมาแบบง่อยเกินไปนะ"*
 * → Choice **"ใบประวัติเต็มหน้า"**: หัว = ชื่อ เพศ อายุ เบอร์ ตำแหน่งที่สมัคร · ข้อมูลแบบใบประวัติ ·
 *   ไฟล์ที่แนบมาเปิดในป๊อปเลย · ประวัติการสมัคร + ผลโทรต่อท้าย
 * - ขั้นตอนติดต่อ/นัดหมาย **ไม่อยู่ที่นี่** — อยู่ป๊อปของแท็บการติดตาม (`ApplicantContactDialog`) เหมือนเดิม
 * - แก้ข้อมูลยังทำได้ (ฟอร์มชุดเดิม · ระบบเก็บ log ว่าใครแก้ ไม่โชว์) — กด "แก้ไข" ที่หัวข้อข้อมูลส่วนตัว
 * - ปุ่มโทร = เปิดแอปโทรของเครื่องอย่างเดียว ไม่จองใบ (จองใบ/ล็อกเบอร์ยังเป็นปุ่ม "เก็บไปโทรเอง" บนแถว)
 */
const EMPTY_EXTRAS: ApplicantDetailExtras = { history: [], aiCalls: [], staffCalls: [] };

const text = (v: string | number | null | undefined, unit = ''): string =>
  v === null || v === undefined || String(v).trim() === '' ? EM_DASH : `${v}${unit}`;

const Row: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
  <div className={cn('flex min-w-0 gap-3', wide && 'sm:col-span-2')}>
    <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
    <dd className="min-w-0 flex-1 break-words text-sm text-foreground">{children}</dd>
  </div>
);

const Section: React.FC<{ title: string; aside?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  aside,
  children,
}) => (
  <Card className="space-y-3 rounded-2xl p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {aside}
    </div>
    {children}
  </Card>
);

export default function ApplicantProfileDialog({
  application,
  onClose,
  onSaved,
}: {
  application: PublicApplication | null;
  onClose: () => void;
  /** แก้ข้อมูล/แก้เบอร์สำเร็จ — ให้หน้าแม่โหลดรายชื่อใหม่ */
  onSaved: () => void;
}) {
  const a = application;
  const [extras, setExtras] = useState<ApplicantDetailExtras>(EMPTY_EXTRAS);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // เปิดคนใหม่ = เริ่มใหม่ทั้งหมด · กัน response ของคนก่อนมาทับ (กดไล่แถวเร็ว ๆ)
  useEffect(() => {
    if (!application) return;
    let cancelled = false;
    setExtras(EMPTY_EXTRAS);
    setEditing(false);
    setDraft(null);
    setBusy(false);
    setError(null);
    void fetchApplicantDetailExtras(application.id).then((v) => !cancelled && setExtras(v));
    return () => {
      cancelled = true;
    };
  }, [application]);

  const baseDraft = useMemo(() => (a ? profileDraftOf(a) : null), [a]);
  const callRows = useMemo(() => detailCallRows(extras.aiCalls, extras.staffCalls), [extras]);

  if (!a || !baseDraft) return null;

  const name = `${a.title_prefix ?? ''}${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.full_name;
  const gender = a.gender ? (PROFILE_GENDER_LABEL[a.gender as ProfileGender] ?? a.gender) : null;
  const days = daysSinceApplied(a.created_at, new Date());
  const appliedText = days === null ? null : days === 0 ? 'สมัครวันนี้' : `สมัครมาแล้ว ${days.toLocaleString('th-TH')} วัน`;
  const address = [a.subdistrict, a.district, a.province].map((v) => (v ?? '').trim()).filter(Boolean).join(' ');
  const profile = editing && draft ? profilePatchFromDraft(baseDraft, draft) : { patch: {}, error: null };
  const dirty = Object.keys(profile.patch).length > 0;

  const save = async () => {
    if (busy) return;
    setError(null);
    if (profile.error) return setError(profile.error);
    setBusy(true);
    try {
      await updateApplicationProfile(a.id, profile.patch);
      onSaved();
      setEditing(false);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {/* ── หัวใบประวัติ ── */}
        <DialogHeader className="space-y-0 text-left">
          {/* pr-8 = เว้นที่ให้ปุ่มปิด (×) มุมขวาบนของป๊อป ไม่ให้ปุ่มโทรไปชน */}
          <div className="flex flex-wrap items-start gap-3 pr-8">
            <span
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-medium',
                TONE.primary.soft,
                TONE.primary.value,
              )}
              aria-hidden
            >
              {(a.first_name || a.full_name || '?').trim().slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-lg font-medium leading-tight text-foreground">{name}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {[gender, a.age ? `${a.age} ปี` : null].filter(Boolean).join(' · ') || EM_DASH}
              </p>
              <DialogDescription className="text-sm text-foreground">สมัคร {applicationJobLabel(a)}</DialogDescription>
              <p className="text-xs text-muted-foreground">
                {[appliedText, a.origin ? `มาจาก ${APPLICATION_ORIGIN_LABEL[a.origin]}` : null, a.channel_label || null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {a.phone ? (
                <Button asChild size="xs" variant="outline" className={TONE.info.value}>
                  <a href={`tel:${a.phone}`} aria-label={`โทรหา ${name}`}>
                    <Phone aria-hidden />
                    <span className="tabular-nums">{a.phone}</span>
                  </a>
                </Button>
              ) : null}
              {a.phone_callable === false ? <ApplicantPhoneFix applicationId={a.id} onFixed={onSaved} /> : null}
            </div>
          </div>
        </DialogHeader>

        {/* ── ข้อมูลส่วนตัว ── */}
        <Section
          title="ข้อมูลส่วนตัว"
          aside={
            <Button
              type="button"
              size="xs"
              variant={editing ? 'outline' : 'ghost'}
              disabled={busy}
              onClick={() => {
                if (editing) {
                  setEditing(false);
                  setDraft(null);
                } else {
                  setDraft(baseDraft);
                  setEditing(true);
                }
                setError(null);
              }}
            >
              {editing ? (
                'ยกเลิกแก้ไข'
              ) : (
                <>
                  <Pencil aria-hidden /> แก้ไข
                </>
              )}
            </Button>
          }
        >
          {editing ? (
            <>
              <ApplicantInfoPanel
                application={a}
                editing
                draft={draft ?? baseDraft}
                onDraft={setDraft}
                disabled={busy}
              />
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={() => void save()} disabled={!dirty || busy}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden /> : null} บันทึก
                </Button>
              </div>
            </>
          ) : (
            <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2" data-testid="profile-facts">
              <Row label="ที่อยู่" wide>
                {address || EM_DASH}
              </Row>
              <Row label="การศึกษา">{text(a.education)}</Row>
              <Row label="ใบขับขี่">{text((a.license_types ?? []).join(', '))}</Row>
              <Row label="น้ำหนัก">{text(a.weight_kg, ' กก.')}</Row>
              <Row label="ส่วนสูง">{text(a.height_cm, ' ซม.')}</Row>
              <Row label="LINE">{text(a.line_id)}</Row>
              <Row label="ผู้รับผิดชอบ">{text(a.responsible_name)}</Row>
              <Row label="ฝากไว้" wide>
                {a.note?.trim() ? <span className="whitespace-pre-line">“{a.note.trim()}”</span> : EM_DASH}
              </Row>
            </dl>
          )}
          {error ? (
            <p role="alert" className={cn('text-xs font-medium', TONE.danger.value)}>
              {error}
            </p>
          ) : null}
        </Section>

        {/* ── ไฟล์ประวัติที่แนบ — เปิดให้เลย (ไม่ต้องกด) ── */}
        <Section title="ไฟล์ประวัติที่แนบ">
          {a.has_document ? (
            <ApplicantAttachmentPanel
              applicationId={a.id}
              hasDocument={a.has_document}
              filename={a.document_filename}
              mime={a.document_mime}
              autoLoad
            />
          ) : (
            <p className="text-sm text-muted-foreground">ไม่ได้แนบไฟล์</p>
          )}
        </Section>

        {/* ── ประวัติการสมัคร + ผลโทร ── */}
        <Section title="ประวัติการสมัคร">
          <HistoryTable items={extras.history} />
        </Section>
        <Section title="ผลโทร">
          <CallsTable rows={callRows} application={a} />
        </Section>

        <div className="flex justify-end">
          <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={busy}>
            ปิด
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
