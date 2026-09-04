import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/apiFetch';
import { parseAppUserList } from '@/lib/userApi';
import { THAI_PROVINCE_NAMES_SORTED } from '@/lib/thaiProvinces';
import districtsByProvince from '@/data/thaiDistrictsByProvince.json';
import { recruitChannelLabel, type RecruitChannelMatch } from '@/lib/recruitPostings';
import ChannelPicker from '@/components/shared/ChannelPicker';
import JobTitleField from '@/components/shared/JobTitleField';
import { createApplicationByStaff } from '@/lib/publicApplicationsApi';
import {
  RM_EDUCATION_LEVELS,
  RM_LICENSE_TYPES,
  RM_SEX_OPTIONS,
  RM_SPECIFIC_TYPES,
  normalizeRmPhone,
} from '@/lib/recruitRmMasters';

/**
 * "เพิ่มข้อมูลผู้สมัคร" — เจ้าหน้าที่คีย์ใบสมัครเอง (คนโทรเข้ามาสมัคร ไม่ได้กรอกลิงก์)
 *
 * ช่องทั้งหมดตามฟอร์มของระบบเดิมที่เจ้าของส่งมา 11 ส.ค. 2569:
 * ชื่อ · นามสกุล · อายุ · เพศ · เบอร์โทร · LINE ID · จังหวัด · อำเภอ ·
 * ตำแหน่งงานที่สนใจ · ประเภทเจาะจง · วุฒิการศึกษา · ผู้รับผิดชอบ ·
 * ช่องทางการรับสมัคร · ประเภทใบขับขี่
 *
 * ⚠️ บันทึกลง**ตารางใบสมัครเดียวกับที่มาจากลิงก์** — ไม่แยกตารางใหม่ ไม่งั้นยอดในหน้า
 * RM กับบอร์ดนับไม่ตรงกัน · ใบที่คีย์เองจะมี "ผู้บันทึก" ติดไว้
 *
 * ⚠️ ตำแหน่งงาน/ผู้รับผิดชอบ/ช่องทาง ดึงจากของที่ระบบมีจริง (ผู้ใช้ในระบบ + master
 * ช่องทาง) ไม่ทำ master ซ้ำอีกชุด · ตำแหน่งเป็นช่องพิมพ์เพราะฝั่งเรายังไม่มี master ตำแหน่ง
 */

const fieldCls =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30';
const labelCls = 'text-xs font-medium text-muted-foreground';

const DISTRICTS = districtsByProvince as Record<string, string[]>;

const AddApplicantDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /**
   * ใบขอที่จะผูกใบสมัครให้เลย (20 ส.ค. 2569 — เจ้าของสั่ง: *"กรณีโทรมาไม่ได้กรอก
   * ในกล่องงานสามารถเพิ่มผู้สมัครจากกล่องนั้น ๆ ได้"*) · ไม่ส่ง = สมัครทั่วไปแบบเดิม
   */
  job?: { id: string; title?: string | null; unitName?: string | null; positionLabel?: string | null } | null;
  /** true = คืนเนื้อฟอร์มเปล่า ๆ ไม่ห่อ Dialog (ฝังในป๊อป "ดูรายชื่อ" — ห้ามซ้อน Dialog) */
  embedded?: boolean;
}> = ({ open, onClose, onSaved, job = null, embedded = false }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [lineId, setLineId] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [positionInterest, setPositionInterest] = useState('');
  const [specificType, setSpecificType] = useState('');
  const [education, setEducation] = useState('');
  const [responsible, setResponsible] = useState('');
  /** ช่องทางที่ผู้สมัครมาจาก — 1:1 ตาม ChannelPicker แบบใหม่ (2 ก.ย. 2569) */
  const [channel, setChannel] = useState<RecruitChannelMatch | null>(null);
  const [licenses, setLicenses] = useState<string[]>([]);

  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFirstName('');
    setLastName('');
    setAge('');
    setGender('');
    setPhone('');
    setLineId('');
    setProvince('');
    setDistrict('');
    setPositionInterest(job?.positionLabel ?? '');
    setSpecificType('');
    setEducation('');
    setResponsible('');
    setChannel(null);
    setLicenses([]);
    setError(null);
    setSaving(false);
    void apiFetch('/api/app-users')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setStaff(
          parseAppUserList(data)
            .filter((u) => u.is_active)
            .map((u) => ({ id: u.id, name: u.full_name || u.email })),
        ),
      )
      .catch(() => setStaff([]));
    // เปิดจากคนละใบ = ตำแหน่ง prefill คนละค่า
  }, [open, job?.positionLabel]);

  const districts = province ? (DISTRICTS[province] ?? []) : [];

  const toggleLicense = (t: string) =>
    setLicenses((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const submit = async () => {
    setError(null);
    // ตรวจฝั่งหน้าเว็บด้วยกติกาเดียวกับ API (recruitRmMasters) — ไม่ให้ error สองแบบ
    if (!firstName.trim()) return setError('กรุณากรอกชื่อ');
    if (!lastName.trim()) return setError('กรุณากรอกนามสกุล');
    if (!normalizeRmPhone(phone)) return setError('กรุณากรอกเบอร์โทรให้ครบ 10 หลัก');
    if (!gender) return setError('กรุณาเลือกเพศ');
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 15 || ageNum > 80) {
      return setError('อายุต้องอยู่ระหว่าง 15–80 ปี');
    }

    setSaving(true);
    try {
      await createApplicationByStaff({
        // ผูกใบขอเมื่อเปิดจากป๊อปของใบ (ดู prop `job` ข้างบน)
        job_id: job?.id ?? null,
        job_title: job?.title ?? null,
        unit_name: job?.unitName ?? null,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone,
        age: ageNum,
        gender,
        line_id: lineId.trim() || null,
        province: province || null,
        district: district || null,
        position_interest: positionInterest.trim() || null,
        specific_type: specificType || null,
        education: education || null,
        responsible_name: staff.find((u) => u.id === responsible)?.name ?? null,
        channel_id: channel?.id ?? null,
        channel_label: channel ? recruitChannelLabel(channel) : null,
        license_types: licenses,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelCls}>ชื่อ *</label>
              <input className={fieldCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>นามสกุล *</label>
              <input className={fieldCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>อายุ *</label>
              <input
                className={fieldCls}
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>เพศ *</label>
              <div className="flex gap-1.5">
                {RM_SEX_OPTIONS.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => setGender(s.code)}
                    className={
                      gender === s.code
                        ? 'rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary'
                        : 'rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary'
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>เบอร์โทรติดต่อ * (10 หลัก)</label>
              <input
                className={fieldCls}
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xxxxxxxx"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>LINE ID</label>
              <input className={fieldCls} value={lineId} onChange={(e) => setLineId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>จังหวัด</label>
              <select
                className={fieldCls}
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setDistrict(''); // อำเภอของจังหวัดเดิมใช้กับจังหวัดใหม่ไม่ได้
                }}
              >
                <option value="">ไม่ระบุ</option>
                {THAI_PROVINCE_NAMES_SORTED.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>อำเภอ/เขต</label>
              <select
                className={fieldCls}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                disabled={!province}
              >
                <option value="">{province ? 'ไม่ระบุ' : 'เลือกจังหวัดก่อน'}</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            {/* ฟอร์มนี้ไม่ผูก BU (คนโทรเข้ามาสมัครลอย) — ลิสต์จึงเป็นทุก BU */}
            <JobTitleField
              value={positionInterest}
              onChange={setPositionInterest}
              label="ตำแหน่งงานที่สนใจ"
              inputClassName={fieldCls}
              labelClassName={labelCls}
            />
            <div className="space-y-1.5">
              <label className={labelCls}>ประเภทเจาะจง</label>
              <select
                className={fieldCls}
                value={specificType}
                onChange={(e) => setSpecificType(e.target.value)}
              >
                <option value="">ไม่ระบุ</option>
                {RM_SPECIFIC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>วุฒิการศึกษา</label>
              <select className={fieldCls} value={education} onChange={(e) => setEducation(e.target.value)}>
                <option value="">ไม่ระบุ</option>
                {RM_EDUCATION_LEVELS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>ผู้รับผิดชอบ</label>
              <select
                className={fieldCls}
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
              >
                <option value="">ไม่ระบุ</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelCls}>ช่องทางการรับสมัคร</label>
              <ChannelPicker value={channel} onChange={setChannel} reloadKey={open} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>ประเภทใบขับขี่ (ถ้ามี)</label>
            <div className="flex flex-wrap gap-1.5">
              {RM_LICENSE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleLicense(t)}
                  className={
                    licenses.includes(t)
                      ? 'rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary'
                      : 'rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary'
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p> : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border/50 px-5 py-3">
          <Button variant="secondary" size="sm" type="button" onClick={onClose} >
            ปิด
          </Button>
          <Button size="sm"
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
            )}
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
    </>
  );

  /** ฝังในป๊อป "ดูรายชื่อ" = คืนเนื้อฟอร์มเปล่า ๆ (ห้ามซ้อน Dialog ใน Dialog) */
  if (embedded) return open ? body : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-[38rem] flex-col gap-0 overflow-hidden rounded-[1.5rem] p-0">
        <DialogHeader className="shrink-0 border-b border-border/50 px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold">เพิ่มข้อมูลผู้สมัคร</DialogTitle>
          <DialogDescription className="text-xs">
            สำหรับคนที่โทรเข้ามาสมัคร — ใบนี้จะไปอยู่รวมกับใบสมัครจากลิงก์ และมีชื่อผู้บันทึกติดไว้
          </DialogDescription>
        </DialogHeader>

        {body}
      </DialogContent>
    </Dialog>
  );
};

export default AddApplicantDialog;
