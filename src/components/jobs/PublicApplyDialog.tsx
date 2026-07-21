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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, Loader2, Send } from 'lucide-react';

export type PublicApplyDialogProps = {
  open: boolean;
  /** งานที่กดสมัคร — null เมื่อสมัครแบบไม่ระบุงาน (ปุ่มท้ายหน้า) */
  job: JobRequest | null;
  onClose: () => void;
};

type Gender = 'male' | 'female' | 'other';

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
    setNote('');
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
      const postalCode = getZipCodeForSubdistrict(province, district, subdistrict);
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

  const fieldCls =
    'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50';
  const labelCls = 'flex flex-col gap-1.5 text-xs font-medium text-foreground';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[min(92dvh,860px)] w-[min(calc(100vw-1.25rem),34rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/50 px-5 pb-3 pt-5 text-left">
          <DialogTitle className="text-base font-semibold sm:text-lg">
            {submitted ? 'ส่งใบสมัครแล้ว' : 'กรอกใบสมัครงาน'}
          </DialogTitle>
          <DialogDescription>
            {submitted
              ? 'ทีมสรรหาจะติดต่อกลับตามเบอร์ที่ให้ไว้'
              : job
                ? `สมัคร: ${jobBoardCardTitle(job)}`
                : 'กรอกข้อมูลติดต่อ แล้วทีมสรรหาจะติดต่อกลับ'}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 px-5 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              ขอบคุณที่สนใจร่วมงานกับเรา เราได้รับข้อมูลของคุณเรียบร้อยแล้ว
            </p>
            <button
              type="button"
              onClick={onClose}
              className="jarvis-pill-btn w-full justify-center py-2.5 text-sm font-semibold"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
            <div className="flex flex-col gap-3.5 overflow-y-auto px-5 py-4">
              {/* ชื่อ */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[7rem_1fr_1fr]">
                <label className={labelCls}>
                  คำนำหน้า
                  <select
                    value={titlePrefix}
                    onChange={(e) => setTitlePrefix(e.target.value)}
                    className={fieldCls}
                  >
                    {TITLE_PREFIX_OPTIONS.filter((o) => o.value).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelCls}>
                  ชื่อ <span className="text-red-500">*</span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="เช่น สมชาย"
                    autoComplete="given-name"
                    required
                    className={fieldCls}
                  />
                </label>
                <label className={labelCls}>
                  นามสกุล <span className="text-red-500">*</span>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="เช่น ใจดี"
                    autoComplete="family-name"
                    required
                    className={fieldCls}
                  />
                </label>
              </div>

              {/* เบอร์ · อายุ · เพศ */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_6rem_7rem]">
                <label className={labelCls}>
                  เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="เช่น 0812345678"
                    autoComplete="tel"
                    inputMode="tel"
                    required
                    className={fieldCls}
                  />
                </label>
                <label className={labelCls}>
                  อายุ <span className="text-red-500">*</span>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="ปี"
                    inputMode="numeric"
                    min={15}
                    max={80}
                    required
                    className={fieldCls}
                  />
                </label>
                <label className={labelCls}>
                  เพศ <span className="text-red-500">*</span>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className={fieldCls}
                  >
                    <option value="male">ชาย</option>
                    <option value="female">หญิง</option>
                    <option value="other">อื่นๆ</option>
                  </select>
                </label>
              </div>

              {/* ที่อยู่ — cascade */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className={labelCls}>
                  จังหวัด <span className="text-red-500">*</span>
                  <select
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value);
                      setDistrict('');
                      setSubdistrict('');
                    }}
                    required
                    className={fieldCls}
                  >
                    <option value="">— เลือกจังหวัด —</option>
                    {provinceOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelCls}>
                  อำเภอ / เขต <span className="text-red-500">*</span>
                  <select
                    value={district}
                    onChange={(e) => {
                      setDistrict(e.target.value);
                      setSubdistrict('');
                    }}
                    disabled={!province}
                    required
                    className={fieldCls}
                  >
                    <option value="">
                      {!province ? 'เลือกจังหวัดก่อน' : '— เลือกอำเภอ/เขต —'}
                    </option>
                    {districtOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelCls}>
                  ตำบล / แขวง <span className="text-red-500">*</span>
                  <select
                    value={subdistrict}
                    onChange={(e) => setSubdistrict(e.target.value)}
                    disabled={!province || !district}
                    required
                    className={fieldCls}
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
                </label>
              </div>

              <label className={labelCls}>
                ตำแหน่งที่สนใจ
                <input
                  type="text"
                  value={positionInterest}
                  onChange={(e) => setPositionInterest(e.target.value)}
                  placeholder="เช่น พนักงานขับรถ"
                  className={fieldCls}
                />
              </label>

              <label className={labelCls}>
                ข้อมูลเพิ่มเติม (ถ้ามี)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น ประสบการณ์ หรือเวลาที่สะดวกให้ติดต่อ"
                  rows={2}
                  className={fieldCls}
                />
              </label>

              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-border/50 px-5 py-3">
              <button
                type="submit"
                disabled={submitting}
                className="jarvis-pill-btn inline-flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
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
