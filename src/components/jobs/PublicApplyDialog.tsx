import React, { useEffect, useMemo, useState } from 'react';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { apiFetch } from '@/lib/apiFetch';
import { TITLE_PREFIX_OPTIONS } from '@/lib/titlePrefixOptions';
import {
  getDistrictOptions,
  getProvinceOptions,
  getSubdistrictOptions,
  getZipCodeForSubdistrict,
} from '@/lib/thaiAddressCascade';
import {
  EDUCATION_LEVELS,
  REFERRAL_SOURCES,
  REFERRAL_SOURCE_LABEL,
} from '@/lib/publicApplicationsApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, ClipboardList, Loader2, MapPin, Paperclip, Send, UserRound, X } from 'lucide-react';

const MAX_DOC_MB = 3;
const DOC_ACCEPT = '.pdf,.jpg,.jpeg,.png';
const DOC_ACCEPT_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

/** อ่านไฟล์เป็น base64 (ไม่รวม data: prefix) */
function readFileAsBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(f);
  });
}

export type PublicApplyDialogProps = {
  open: boolean;
  /** งานที่กดสมัคร — null เมื่อสมัครแบบไม่ระบุงาน (ปุ่มท้ายหน้า) */
  job: JobRequest | null;
  onClose: () => void;
};

type Gender = 'male' | 'female' | 'other';

const Field: React.FC<{
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ label, required, className, children }) => (
  <div className={`space-y-1.5 ${className ?? ''}`}>
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      {required ? <span className="text-red-500"> *</span> : null}
    </label>
    {children}
  </div>
);

const SectionLabel: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary/80">
    {icon}
    <span>{children}</span>
  </div>
);

const PublicApplyDialog: React.FC<PublicApplyDialogProps> = ({ open, job, onClose }) => {
  const [titlePrefix, setTitlePrefix] = useState('นาย');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [education, setEducation] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [positionInterest, setPositionInterest] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provinceOptions = useMemo(() => getProvinceOptions(), []);
  const districtOptions = useMemo(() => getDistrictOptions(province), [province]);
  const subdistrictOptions = useMemo(
    () => getSubdistrictOptions(province, district),
    [province, district],
  );
  const postalCode = useMemo(
    () => (province && district && subdistrict ? getZipCodeForSubdistrict(province, district, subdistrict) : null),
    [province, district, subdistrict],
  );

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setError(null);
    setPositionInterest(job ? jobBoardCardTitle(job) : '');
  }, [open, job]);

  const resetForm = () => {
    setTitlePrefix('นาย');
    setFirstName('');
    setLastName('');
    setPhone('');
    setAge('');
    setGender('male');
    setProvince('');
    setDistrict('');
    setSubdistrict('');
    setWeight('');
    setHeight('');
    setEducation('');
    setReferralSource('');
    setFile(null);
    setNote('');
  };

  const onPickFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    if (!DOC_ACCEPT_MIME.includes(f.type)) {
      setError('รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG');
      return;
    }
    if (f.size > MAX_DOC_MB * 1024 * 1024) {
      setError(`ไฟล์ใหญ่เกินไป (สูงสุด ${MAX_DOC_MB}MB)`);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (firstName.trim().length < 1) return setError('กรุณากรอกชื่อ');
    if (lastName.trim().length < 1) return setError('กรุณากรอกนามสกุล');
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 9 || phoneDigits.length > 11) {
      return setError('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (เช่น 0812345678)');
    }
    const ageNum = Number(age.trim());
    if (!Number.isFinite(ageNum) || ageNum < 15 || ageNum > 80) {
      return setError('กรุณากรอกอายุให้ถูกต้อง (15–80 ปี)');
    }
    if (!province) return setError('กรุณาเลือกจังหวัด');
    if (!district) return setError('กรุณาเลือกอำเภอ/เขต');
    if (!subdistrict) return setError('กรุณาเลือกตำบล/แขวง');

    setSubmitting(true);
    try {
      const document = file
        ? { filename: file.name, mime: file.type, base64: await readFileAsBase64(file) }
        : null;
      const res = await apiFetch('/api/public/apply', {
        method: 'POST',
        body: JSON.stringify({
          title_prefix: titlePrefix || null,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          age: ageNum,
          gender,
          province,
          district,
          subdistrict,
          postal_code: postalCode,
          weight_kg: weight.trim() ? Number(weight) : null,
          height_cm: height.trim() ? Number(height) : null,
          education: education || null,
          referral_source: referralSource || null,
          document,
          job_id: job?.id ?? null,
          job_title: job ? jobBoardCardTitle(job) : null,
          unit_name: job?.unit_name ?? null,
          position_interest: positionInterest.trim() || null,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message || 'ส่งใบสมัครไม่สำเร็จ กรุณาลองใหม่');
      }
      setSubmitted(true);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งใบสมัครไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-[34rem] flex-col gap-0 overflow-hidden rounded-[1.5rem] border-border/70 p-0">
        {/* Header */}
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/50 bg-gradient-to-b from-primary/[0.07] to-transparent px-5 py-4 text-left sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight sm:text-lg">
                {submitted ? 'ส่งใบสมัครแล้ว' : 'กรอกใบสมัครงาน'}
              </DialogTitle>
              <DialogDescription className="mt-0.5 line-clamp-2 text-xs leading-snug sm:text-[13px]">
                {submitted
                  ? 'ทีมสรรหาจะติดต่อกลับตามเบอร์ที่ให้ไว้'
                  : job
                    ? `สมัคร: ${jobBoardCardTitle(job)}`
                    : 'กรอกข้อมูลติดต่อ แล้วทีมสรรหาจะติดต่อกลับ'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/12">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
            </span>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              ขอบคุณที่สนใจร่วมงานกับเรา เราได้รับข้อมูลของคุณเรียบร้อยแล้ว
            </p>
            <button
              type="button"
              onClick={onClose}
              className="jarvis-pill-btn w-full py-3 text-sm font-semibold"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
              {/* ── ข้อมูลผู้สมัคร ── */}
              <section className="space-y-3">
                <SectionLabel icon={<UserRound className="h-3.5 w-3.5" />}>ข้อมูลผู้สมัคร</SectionLabel>

                <div className="grid grid-cols-[5rem_1fr] gap-2.5 sm:grid-cols-[6rem_1fr_1fr]">
                  <Field label="คำนำหน้า">
                    <select
                      value={titlePrefix}
                      onChange={(e) => setTitlePrefix(e.target.value)}
                      className="jarvis-soft-field"
                    >
                      {TITLE_PREFIX_OPTIONS.filter((o) => o.value).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="ชื่อ" required>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="เช่น สมชาย"
                      autoComplete="given-name"
                      required
                      className="jarvis-soft-field"
                    />
                  </Field>
                  <Field label="นามสกุล" required className="col-span-2 sm:col-span-1">
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="เช่น ใจดี"
                      autoComplete="family-name"
                      required
                      className="jarvis-soft-field"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1fr_5.5rem_7rem]">
                  <Field label="เบอร์โทรศัพท์" required className="col-span-2 sm:col-span-1">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="เช่น 0812345678"
                      autoComplete="tel"
                      inputMode="tel"
                      required
                      className="jarvis-soft-field"
                    />
                  </Field>
                  <Field label="อายุ" required>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="ปี"
                      inputMode="numeric"
                      min={15}
                      max={80}
                      required
                      className="jarvis-soft-field"
                    />
                  </Field>
                  <Field label="เพศ" required>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className="jarvis-soft-field"
                    >
                      <option value="male">ชาย</option>
                      <option value="female">หญิง</option>
                      <option value="other">อื่นๆ</option>
                    </select>
                  </Field>
                </div>
              </section>

              {/* ── ที่อยู่ ── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <SectionLabel icon={<MapPin className="h-3.5 w-3.5" />}>ที่อยู่</SectionLabel>
                  {postalCode ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                      รหัสไปรษณีย์ {postalCode}
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <Field label="จังหวัด" required>
                    <select
                      value={province}
                      onChange={(e) => {
                        setProvince(e.target.value);
                        setDistrict('');
                        setSubdistrict('');
                      }}
                      required
                      className="jarvis-soft-field"
                    >
                      <option value="">— เลือกจังหวัด —</option>
                      {provinceOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="อำเภอ / เขต" required>
                    <select
                      value={district}
                      onChange={(e) => {
                        setDistrict(e.target.value);
                        setSubdistrict('');
                      }}
                      disabled={!province}
                      required
                      className="jarvis-soft-field disabled:opacity-50"
                    >
                      <option value="">{!province ? 'เลือกจังหวัดก่อน' : '— เลือกอำเภอ/เขต —'}</option>
                      {districtOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="ตำบล / แขวง" required>
                    <select
                      value={subdistrict}
                      onChange={(e) => setSubdistrict(e.target.value)}
                      disabled={!province || !district}
                      required
                      className="jarvis-soft-field disabled:opacity-50"
                    >
                      <option value="">
                        {!province || !district ? 'เลือกอำเภอ/เขตก่อน' : '— เลือกตำบล/แขวง —'}
                      </option>
                      {subdistrictOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </section>

              {/* ── ข้อมูลเพิ่มเติม ── */}
              <section className="space-y-3">
                <SectionLabel icon={<ClipboardList className="h-3.5 w-3.5" />}>ข้อมูลเพิ่มเติม</SectionLabel>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <Field label="น้ำหนัก (กก.)">
                    <input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="กก."
                      inputMode="decimal"
                      min={20}
                      max={400}
                      className="jarvis-soft-field"
                    />
                  </Field>
                  <Field label="ส่วนสูง (ซม.)">
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="ซม."
                      inputMode="decimal"
                      min={80}
                      max={260}
                      className="jarvis-soft-field"
                    />
                  </Field>
                  <Field label="วุฒิการศึกษา" className="col-span-2">
                    <select
                      value={education}
                      onChange={(e) => setEducation(e.target.value)}
                      className="jarvis-soft-field"
                    >
                      <option value="">— เลือกวุฒิ —</option>
                      {EDUCATION_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="เห็นประกาศจากช่องทางไหน">
                  <select
                    value={referralSource}
                    onChange={(e) => setReferralSource(e.target.value)}
                    className="jarvis-soft-field"
                  >
                    <option value="">— เลือกช่องทาง —</option>
                    {REFERRAL_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {REFERRAL_SOURCE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={`แนบเอกสาร (PDF/รูป ≤ ${MAX_DOC_MB}MB)`}>
                  {file ? (
                    <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-secondary/40 px-3 py-2">
                      <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        aria-label="ลบไฟล์"
                        className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background/60 px-3 py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground">
                      <Paperclip className="h-4 w-4" />
                      เลือกไฟล์เอกสาร (เช่น เรซูเม่ วุฒิ บัตรประชาชน)
                      <input
                        type="file"
                        accept={DOC_ACCEPT}
                        onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                        className="hidden"
                      />
                    </label>
                  )}
                </Field>
              </section>

              {/* ── ตำแหน่ง / หมายเหตุ ── */}
              <section className="space-y-3">
                <SectionLabel icon={<Send className="h-3.5 w-3.5" />}>ตำแหน่งที่สนใจ</SectionLabel>
                <Field label="ตำแหน่งที่สนใจ">
                  <input
                    type="text"
                    value={positionInterest}
                    onChange={(e) => setPositionInterest(e.target.value)}
                    placeholder="เช่น พนักงานขับรถ"
                    className="jarvis-soft-field"
                  />
                </Field>
                <Field label="ข้อมูลเพิ่มเติม (ถ้ามี)">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="เช่น ประสบการณ์ หรือเวลาที่สะดวกให้ติดต่อ"
                    rows={2}
                    className="jarvis-soft-area resize-none"
                  />
                </Field>
              </section>

              {error ? (
                <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
                  {error}
                </p>
              ) : null}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-border/50 bg-background/80 px-5 py-3 sm:px-6 sm:py-4">
              <button
                type="submit"
                disabled={submitting}
                className="jarvis-pill-btn w-full py-3 text-sm font-semibold"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                ส่งใบสมัคร
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PublicApplyDialog;
