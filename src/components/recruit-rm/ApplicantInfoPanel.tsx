import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ApplicantAttachmentPanel from '@/components/recruit-rm/ApplicantAttachmentPanel';
import { cn } from '@/lib/utils';
import { EM_DASH } from '@/lib/displayFallback';
import { APPLICATION_ORIGIN_LABEL, type PublicApplication, REFERRAL_SOURCE_LABEL } from '@/lib/publicApplicationsApi';
import { applicantResponsibleName, applicationJobLabel } from '@/lib/recruitRm';
import { getJobStaffApiCache, JOB_STAFF_ROSTER_CHANGED_EVENT, refreshJobStaffFromApi } from '@/lib/jobStaffRemote';
import {
  PROFILE_EDUCATION_OPTIONS,
  PROFILE_GENDER_LABEL,
  PROFILE_LICENSE_OPTIONS,
  PROFILE_SPECIFIC_TYPE_OPTIONS,
  PROFILE_TITLE_PREFIXES,
  type ProfileDraft,
  type ProfileGender,
} from '@/lib/applicantProfileEdit';

/**
 * แท็บ "ข้อมูลผู้สมัคร" ในป๊อปรายละเอียด (แบบรูป iRecruit · เจ้าของสั่ง 1 ต.ค. 2569)
 *
 * ตารางสามคอลัมน์ ป้ายเล็กด้านบน ค่าอยู่ใต้ป้าย · กด "แก้ไขข้อมูล" แล้วช่องที่แก้ได้กลายเป็นช่องกรอก
 * ช่องที่แก้ไม่ได้ (เบอร์ · ตำแหน่งงาน · ช่องทาง · ที่มา) ยังเป็นข้อความ · ผู้สรรหา/ผู้รับผิดชอบ/ประเภทเจาะจง แก้ได้ตั้งแต่ 19 ต.ค. 2569
 * ⚠️ เบอร์แก้ที่ช่องแก้เบอร์เดิม (เป็นคีย์ของล็อกโทร) · ค่าที่ส่งคือฟอร์มทั้งก้อน หน้าแม่เป็นคนหาช่องที่เปลี่ยน
 * ⚠️ "ผู้สร้างช่องทาง" ในรูปเดิม → ใช้ "ผู้รับผิดชอบ" — jarvis ไม่ได้เก็บคนสร้างช่องทางไว้กับใบสมัคร
 *    "โพสต์ประกาศงาน" → ใช้ "ที่มา" (สมัครใหม่ / AI หาให้ / เจ้าหน้าที่คีย์) ด้วยเหตุผลเดียวกัน
 */
const NO_PREFIX = '__none__';

const Field: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({
  label,
  className,
  children,
}) => (
  <div className={cn('min-w-0 space-y-1', className)}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="break-words text-sm text-foreground">{children}</div>
  </div>
);

const show = (v: string | number | null | undefined, unit = ''): string => {
  if (v === null || v === undefined || String(v).trim() === '') return EM_DASH;
  return `${v}${unit}`;
};

const ApplicantInfoPanel: React.FC<{
  application: PublicApplication;
  editing: boolean;
  draft: ProfileDraft;
  onDraft: (next: ProfileDraft) => void;
  disabled?: boolean;
  /** ช่องแก้เบอร์ (ใบที่ติดธงเบอร์ใช้โทรไม่ได้) — หน้าแม่เป็นเจ้าของ state */
  phoneFixSlot?: React.ReactNode;
  /**
   * ข้อมูลผู้สรรหา = เจ้าหน้าที่สรรหาของใบขอที่คนนี้สมัคร (คิว แบงค์ · ชื่อเดียวกับคอลัมน์ "เจ้าของงาน")
   * หน้าแม่หาให้จากใบขอที่โหลดไว้ (`recruiterOf` / ใบขอของป๊อปการ์ด) · ไม่รู้ = ขีด
   */
  recruiterName?: string | null;
  /** ผู้สรรหาของใบขอ (ไม่นับที่แก้รายคน) — ตัวเลือก "ตามใบขอ" ตอนแก้ · ไม่ส่ง = ใช้ recruiterName */
  jobRecruiterName?: string | null;
}> = ({ application: a, editing, draft, onDraft, disabled = false, phoneFixSlot, recruiterName = null, jobRecruiterName }) => {
  /**
   * รายชื่อให้เลือกตอนแก้ (เจ้าของ 19 ต.ค. 2569 "ข้อมูลผู้สรรหา ทำให้แก้ไขได้" + ผู้รับผิดชอบ + ประเภทเจาะจง)
   * ผู้สรรหา = สายงานสรรหา · ผู้รับผิดชอบ = ทีม Online (ตั้ง ตั้งค่า › ผู้ใช้งาน) · ค่าเดิมนอกรายการยังเลือกค้างไว้ได้
   */
  const [rosterRev, setRosterRev] = useState(0);
  useEffect(() => {
    if (!editing) return;
    void refreshJobStaffFromApi();
    const on = () => setRosterRev((n) => n + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, on);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, on);
  }, [editing]);
  void rosterRev;
  const roster = getJobStaffApiCache();
  const withCurrent = (names: readonly string[] | undefined, current: string) => {
    const list = [...new Set((names ?? []).map((n) => n.trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'th'));
    return current && !list.includes(current) ? [current, ...list] : list;
  };
  // 🔴 19 ต.ค. 2569 เจ้าของ: "ลบ Account ต่อ ออกแล้ว เพิ่ม ไอซ์ … ทำไมยังมีชื่อ ต่อ" — เดิมอ่านรายชื่อทีมชุดเก่า (job_staff_roster)
  // ⇒ อ่านจากหน้าผู้ใช้งาน (ชื่อเล่น + สายงาน) ที่เดียว · ลบบัญชี/ถอดสายงาน = หายจากลิสต์
  const lane = (l: string) => (roster?.directory ?? []).filter((d) => d.lanes.includes(l)).map((d) => d.name);
  const recruiterOptions = withCurrent(lane('recruiter'), draft.recruiter_name);
  const responsibleOptions = withCurrent(lane('online'), draft.responsible_name);
  const specificOptions = draft.specific_type && !PROFILE_SPECIFIC_TYPE_OPTIONS.includes(draft.specific_type)
    ? [draft.specific_type, ...PROFILE_SPECIFIC_TYPE_OPTIONS]
    : PROFILE_SPECIFIC_TYPE_OPTIONS;
  const jobRecruiter = (jobRecruiterName === undefined ? recruiterName : jobRecruiterName)?.trim() || null;
  const linkOwner = (a.posting_owner_name ?? '').trim() || null;
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => onDraft({ ...draft, [key]: value });
  const educationOptions = draft.education && !PROFILE_EDUCATION_OPTIONS.includes(draft.education)
    ? [draft.education, ...PROFILE_EDUCATION_OPTIONS]
    : PROFILE_EDUCATION_OPTIONS;
  const licenseOptions = [
    ...PROFILE_LICENSE_OPTIONS,
    ...draft.license_types.filter((x) => !PROFILE_LICENSE_OPTIONS.includes(x)),
  ];
  const genderLabel = a.gender ? PROFILE_GENDER_LABEL[a.gender as ProfileGender] ?? a.gender : null;

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
      <Field label="ชื่อ">
        {editing ? (
          /* 🔴 คำนำหน้าห่อกล่องกว้างคงที่ (QA 5 ต.ค. 2569: จอ 375 ช่องคำนำหน้ากว้าง 313px ช่องชื่อเหลือ 38px —
             `jarvis-soft-field` ของ SelectTrigger ตั้ง w-full ทับ w-24) · ช่องชื่อกินที่เหลือ */
          <div className="flex gap-1.5">
            <div className="w-24 shrink-0">
            <Select
              value={draft.title_prefix || NO_PREFIX}
              onValueChange={(v) => set('title_prefix', v === NO_PREFIX ? '' : v)}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 text-xs" aria-label="คำนำหน้า">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PREFIX}>ไม่ระบุ</SelectItem>
                {PROFILE_TITLE_PREFIXES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
            <Input
              value={draft.first_name}
              onChange={(e) => set('first_name', e.target.value)}
              disabled={disabled}
              aria-label="ชื่อ"
              className="h-9 min-w-0 flex-1 text-sm"
            />
          </div>
        ) : (
          show(`${a.title_prefix ?? ''}${a.first_name ?? ''}`.trim() || a.full_name)
        )}
      </Field>
      <Field label="นามสกุล">
        {editing ? (
          <Input
            value={draft.last_name}
            onChange={(e) => set('last_name', e.target.value)}
            disabled={disabled}
            aria-label="นามสกุล"
            className="h-9 text-sm"
          />
        ) : (
          show(a.last_name)
        )}
      </Field>
      <Field label="เพศ">
        {editing ? (
          <Select value={draft.gender || undefined} onValueChange={(v) => set('gender', v as ProfileGender)} disabled={disabled}>
            <SelectTrigger className="h-9 text-sm" aria-label="เพศ">
              <SelectValue placeholder="เลือกเพศ" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROFILE_GENDER_LABEL) as ProfileGender[]).map((g) => (
                <SelectItem key={g} value={g}>
                  {PROFILE_GENDER_LABEL[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          show(genderLabel)
        )}
      </Field>

      <Field label="อายุ">
        {editing ? (
          <Input
            type="number"
            inputMode="numeric"
            value={draft.age}
            onChange={(e) => set('age', e.target.value)}
            disabled={disabled}
            aria-label="อายุ"
            className="h-9 text-sm tabular-nums"
          />
        ) : (
          show(a.age, ' ปี')
        )}
      </Field>
      <Field label="เบอร์โทรติดต่อ">
        <span className="tabular-nums">{show(a.phone)}</span>
        {phoneFixSlot}
      </Field>
      <Field label="LINE ID">
        {editing ? (
          <Input
            value={draft.line_id}
            onChange={(e) => set('line_id', e.target.value)}
            disabled={disabled}
            aria-label="LINE ID"
            className="h-9 text-sm"
          />
        ) : (
          show(a.line_id)
        )}
      </Field>

      <Field label="จังหวัดที่อยู่อาศัย">
        {editing ? (
          <Input
            value={draft.province}
            onChange={(e) => set('province', e.target.value)}
            disabled={disabled}
            aria-label="จังหวัดที่อยู่อาศัย"
            className="h-9 text-sm"
          />
        ) : (
          show(a.province)
        )}
      </Field>
      <Field label="อำเภอ/เขต">
        {editing ? (
          <Input
            value={draft.district}
            onChange={(e) => set('district', e.target.value)}
            disabled={disabled}
            aria-label="อำเภอ/เขต"
            className="h-9 text-sm"
          />
        ) : (
          show(a.district)
        )}
      </Field>
      <Field label="ตำแหน่งงาน">{applicationJobLabel(a)}</Field>

      {/* ช่องทางอ่านแบบเดียวกับตาราง — ตารางช่องทางของลิงก์ก่อน ไม่มีค่อยใช้ที่ผู้สมัครเลือกเอง (QA 18 ต.ค. 2569: ป๊อปขึ้น "—" แต่ตารางขึ้น TikTok) */}
      <Field label="ช่องทาง">{show(a.channel_label?.trim() || (a.referral_source ? REFERRAL_SOURCE_LABEL[a.referral_source] : null))}</Field>
      {/* 🔴 16 ต.ค. 2569 เจ้าของ: "ผู้สรรหาก็พวก คิว แบงค์" · "ผู้รับผิดชอบ ก็ทีม online อะ ว่าน เจมส์"
          เดิมช่องแรกอ่าน `specific_type` (ประเภทเจาะจง) ซึ่งผูกผิดความหมาย และยังไม่มีใบไหนกรอก (0/963) — ย้ายไปช่องของตัวเองข้างล่าง */}
      <Field label="ข้อมูลผู้สรรหา">
        {editing ? (
          <Select
            value={draft.recruiter_name || NO_PREFIX}
            onValueChange={(v) => set('recruiter_name', v === NO_PREFIX ? '' : v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 text-sm" aria-label="ข้อมูลผู้สรรหา">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PREFIX}>{jobRecruiter ? `ตามใบขอ (${jobRecruiter})` : 'ตามใบขอ'}</SelectItem>
              {recruiterOptions.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          show((a.recruiter_name ?? '').trim() || recruiterName)
        )}
      </Field>
      <Field label="ผู้รับผิดชอบ">
        {editing ? (
          <Select
            value={draft.responsible_name || NO_PREFIX}
            onValueChange={(v) => set('responsible_name', v === NO_PREFIX ? '' : v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 text-sm" aria-label="ผู้รับผิดชอบ">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PREFIX}>{linkOwner ? `ตามลิงก์ (${linkOwner})` : 'ไม่ระบุ'}</SelectItem>
              {responsibleOptions.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          show(applicantResponsibleName(a))
        )}
      </Field>
      <Field label="ประเภทเจาะจง">
        {editing ? (
          <Select
            value={draft.specific_type || NO_PREFIX}
            onValueChange={(v) => set('specific_type', v === NO_PREFIX ? '' : v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 text-sm" aria-label="ประเภทเจาะจง">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PREFIX}>ไม่ระบุ</SelectItem>
              {specificOptions.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          show(a.specific_type)
        )}
      </Field>

      <Field label="วุฒิการศึกษา">
        {editing ? (
          <Select value={draft.education || undefined} onValueChange={(v) => set('education', v)} disabled={disabled}>
            <SelectTrigger className="h-9 text-sm" aria-label="วุฒิการศึกษา">
              <SelectValue placeholder="เลือกวุฒิ" />
            </SelectTrigger>
            <SelectContent>
              {educationOptions.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          show(a.education)
        )}
      </Field>
      <Field label="ประเภทใบขับขี่">
        {editing ? (
          <div className="space-y-1.5" role="group" aria-label="ประเภทใบขับขี่">
            {licenseOptions.map((opt) => {
              const id = `lic-${a.id}-${opt}`;
              const checked = draft.license_types.includes(opt);
              return (
                <div key={opt} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(v) =>
                      set(
                        'license_types',
                        v === true
                          ? [...draft.license_types, opt]
                          : draft.license_types.filter((x) => x !== opt),
                      )
                    }
                  />
                  <Label htmlFor={id} className="text-xs font-normal">
                    {opt}
                  </Label>
                </div>
              );
            })}
          </div>
        ) : (
          show((a.license_types ?? []).join(', '))
        )}
      </Field>
      <Field label="น้ำหนัก">
        {editing ? (
          <Input
            type="number"
            inputMode="decimal"
            value={draft.weight_kg}
            onChange={(e) => set('weight_kg', e.target.value)}
            disabled={disabled}
            aria-label="น้ำหนัก (กก.)"
            className="h-9 text-sm tabular-nums"
          />
        ) : (
          show(a.weight_kg, ' กก.')
        )}
      </Field>

      <Field label="ส่วนสูง">
        {editing ? (
          <Input
            type="number"
            inputMode="decimal"
            value={draft.height_cm}
            onChange={(e) => set('height_cm', e.target.value)}
            disabled={disabled}
            aria-label="ส่วนสูง (ซม.)"
            className="h-9 text-sm tabular-nums"
          />
        ) : (
          show(a.height_cm, ' ซม.')
        )}
      </Field>

      <Field label="ความคิดเห็น" className="sm:col-span-3">
        {editing ? (
          <Textarea
            value={draft.note}
            onChange={(e) => set('note', e.target.value)}
            disabled={disabled}
            aria-label="ความคิดเห็น"
            className="min-h-16 text-sm"
          />
        ) : (
          <span className="whitespace-pre-line">{show(a.note)}</span>
        )}
      </Field>

      <Field label="ไฟล์แนบ" className="sm:col-span-2">
        {a.has_document ? (
          <ApplicantAttachmentPanel
            applicationId={a.id}
            hasDocument={a.has_document}
            filename={a.document_filename}
            mime={a.document_mime}
          />
        ) : (
          EM_DASH
        )}
      </Field>
      <Field label="ที่มา">{a.origin ? APPLICATION_ORIGIN_LABEL[a.origin] : EM_DASH}</Field>
    </div>
  );
};

export default ApplicantInfoPanel;
