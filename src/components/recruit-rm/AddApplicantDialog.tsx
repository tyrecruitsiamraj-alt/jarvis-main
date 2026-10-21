import React, { useEffect, useState } from 'react';
import { FieldSelect } from '@/components/shared/FieldSelect';
import PdpaConsentCheck from '@/components/shared/PdpaConsentCheck';
import { PDPA_CONSENT_REQUIRED_MESSAGE_STAFF, PDPA_CONSENT_TEXT_STAFF } from '@/lib/pdpaConsent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchResponsibleNames } from '@/lib/applicationImportApi';
import { THAI_PROVINCE_NAMES_SORTED } from '@/lib/thaiProvinces';
import districtsByProvince from '@/data/thaiDistrictsByProvince.json';
import { recruitChannelLabel, type RecruitChannelMatch } from '@/lib/recruitPostings';
import ChannelPicker from '@/components/shared/ChannelPicker';
import SearchableSelect from '@/components/shared/SearchableSelect';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { fetchSiamrajUnitRequests } from '@/lib/siamrajUnitRequestsApi';
import { jobPickKeywords, jobPickLabel } from '@/lib/jobPickLabel';
import { publicJobTitle } from '@/lib/publicJobTitle';
import { publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import type { JobRequest } from '@/types';
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
 * ช่องทาง) ไม่ทำ master ซ้ำอีกชุด
 *
 * 🔴 21 ต.ค. 2569 (เจ้าของ):
 * - *"ตรงตำแหน่งที่สนใจ เอาให้เลือกชื่อจากใบขอเลยมันจะได้ส่งไปให้ Ai คุยได้"* → เลือกจากใบขอที่เปิดอยู่ (ผูก job_id)
 *   · Choice มีตัวเลือก "ยังไม่ระบุ — หาล่วงหน้า" บนสุด (ส่ง AI = บททักทายทั่วไป แล้วค่อยจับคู่)
 * - *"ให้เลือกด้วยว่าส่ง Ai หรือ ไม่ส่ง"* → ต้องเลือก · ไม่ส่ง = Choice "เข้าแท็บการติดต่อของคนเพิ่ม" (server เก็บให้)
 * - *"ไม่ต้อง Lock ว่าต้องกรอกอะไร … บางคนแค่มาเม้น ชื่อ เบอร์โทรไว้"* → บังคับแค่ชื่อ + เบอร์ (+ ยินยอม PDPA)
 */

const labelCls = 'text-xs font-medium text-muted-foreground';

const DISTRICTS = districtsByProvince as Record<string, string[]>;

/** ค่าในช่องตำแหน่งงาน = ยังไม่ผูกใบขอ */
const NO_JOB = '__none__';
type CallMode = 'ai' | 'manual';

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
  /** PDPA (15 ต.ค. 2569) — ยืนยันว่าผู้สมัครยินยอมแล้วก่อนบันทึก */
  const [consent, setConsent] = useState(false);
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  /** ใบขอที่เลือกในช่อง "ตำแหน่งงานที่สนใจ" (NO_JOB = ยังไม่ระบุ) */
  const [jobPick, setJobPick] = useState<string>(NO_JOB);
  const [openJobs, setOpenJobs] = useState<JobRequest[]>([]);
  const [callMode, setCallMode] = useState<CallMode | ''>('');
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
    setJobPick(job?.id ?? NO_JOB);
    setCallMode('');
    setSpecificType('');
    setEducation('');
    setResponsible('');
    setChannel(null);
    setLicenses([]);
    setConsent(false);
    setError(null);
    setSaving(false);
    // 🔴 ห้ามกลับไปใช้ /api/app-users (admin เท่านั้น — คนอื่นได้ลิสต์ว่าง · 11 ต.ค. 2569)
    void fetchResponsibleNames()
      .then(setStaff)
      .catch(() => setStaff([]));
    // ใบขอที่เปิดอยู่ (สิทธิ์ BU ตามบัญชี) — ชุดเดียวกับช่อง "ลงหน่วยงาน" ของนัด
    void fetchSiamrajUnitRequests(500)
      .then(setOpenJobs)
      .catch(() => setOpenJobs([]));
    // เปิดจากคนละใบ = เลือกใบนั้นไว้ให้
  }, [open, job?.id]);

  const districts = province ? (DISTRICTS[province] ?? []) : [];

  const toggleLicense = (t: string) =>
    setLicenses((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const submit = async () => {
    setError(null);
    // ตรวจฝั่งหน้าเว็บด้วยกติกาเดียวกับ API (recruitRmMasters) — ไม่ให้ error สองแบบ
    // บังคับแค่ชื่อ + เบอร์ (21 ต.ค. 2569) · กรอกอายุมาแต่นอกช่วง = คีย์ผิด ยังเตือน
    if (!firstName.trim()) return setError('กรุณากรอกชื่อ');
    if (!normalizeRmPhone(phone)) return setError('กรุณากรอกเบอร์โทรให้ครบ 10 หลัก');
    const ageNum = Number(age);
    if (age.trim() && (!Number.isFinite(ageNum) || ageNum < 15 || ageNum > 80)) {
      return setError('อายุต้องอยู่ระหว่าง 15–80 ปี');
    }
    if (!callMode) return setError('เลือกว่าจะส่ง AI โทร หรือเก็บไปโทรเอง');
    if (!consent) return setError(PDPA_CONSENT_REQUIRED_MESSAGE_STAFF);
    const picked = jobPick === NO_JOB ? null : (openJobs.find((j) => j.id === jobPick) ?? null);
    // เปิดจากป๊อปของใบที่ไม่อยู่ในลิสต์ใบเปิด (หรือลิสต์ยังไม่มา) = ใช้ข้อมูลใบที่ส่งมา
    const fromProp = !picked && job && jobPick === job.id ? job : null;

    setSaving(true);
    try {
      await createApplicationByStaff({
        // ผูกใบขอเมื่อเปิดจากป๊อปของใบ (ดู prop `job` ข้างบน)
        job_id: picked?.id ?? fromProp?.id ?? null,
        job_title: picked ? publicJobPositionLabel(picked) : (fromProp?.title ?? null),
        unit_name: picked ? (picked.unit_name ?? null) : (fromProp?.unitName ?? null),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone,
        age: age.trim() ? ageNum : null,
        gender: gender || null,
        line_id: lineId.trim() || null,
        province: province || null,
        district: district || null,
        position_interest: picked ? publicJobTitle(picked) : (fromProp?.positionLabel ?? null),
        specific_type: specificType || null,
        education: education || null,
        responsible_name: staff.find((u) => u.id === responsible)?.name ?? null,
        channel_id: channel?.id ?? null,
        channel_label: channel ? recruitChannelLabel(channel) : null,
        license_types: licenses,
        call_mode: callMode,
        pdpa_consent: true,
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
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>นามสกุล</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>อายุ</label>
              <Input
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>เพศ</label>
              <div className="flex gap-1.5">
                {RM_SEX_OPTIONS.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => setGender(s.code)}
                    className={
                      gender === s.code
                        ? 'rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary'
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
              <Input
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xxxxxxxx"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>LINE ID</label>
              <Input value={lineId} onChange={(e) => setLineId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>จังหวัด</label>
              <FieldSelect
                ariaLabel="จังหวัด"
                value={province}
                onChange={(v) => {
                  setProvince(v);
                  setDistrict(''); // อำเภอของจังหวัดเดิมใช้กับจังหวัดใหม่ไม่ได้
                }}
                options={[{ value: '', label: 'ไม่ระบุ' }, ...THAI_PROVINCE_NAMES_SORTED.map((p) => ({ value: p, label: p }))]}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>อำเภอ/เขต</label>
              <FieldSelect
                ariaLabel="อำเภอ/เขต"
                value={district}
                onChange={setDistrict}
                disabled={!province}
                options={[{ value: '', label: province ? 'ไม่ระบุ' : 'เลือกจังหวัดก่อน' }, ...districts.map((d) => ({ value: d, label: d }))]}
              />
            </div>
            {/* เลือกจากใบขอ (21 ต.ค. 2569) — ผูกใบแล้ว AI คุยเรื่องงานใบนั้นได้ · ไม่มีใบตรง = หาล่วงหน้า */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelCls}>ตำแหน่งงานที่สนใจ</label>
              <div aria-label="ตำแหน่งงานที่สนใจ" data-testid="add-applicant-job">
                <SearchableSelect
                  value={jobPick}
                  onChange={setJobPick}
                  placeholder="เลือกใบขอ"
                  searchPlaceholder="พิมพ์ชื่อหน่วยงาน ตำแหน่ง หรือเลขที่ใบขอ"
                  emptyText="ไม่พบใบขอ"
                  options={[
                    { value: NO_JOB, label: 'ยังไม่ระบุ — หาล่วงหน้า' },
                    // เปิดจากป๊อปของใบที่ไม่อยู่ในลิสต์ใบเปิด — ยังเลือกใบนั้นได้
                    ...(job && !openJobs.some((j) => j.id === job.id)
                      ? [{ value: job.id, label: [job.unitName, job.positionLabel].filter(Boolean).join(' · ') || 'ใบขอนี้' }]
                      : []),
                    ...openJobs.map((j) => ({
                      value: j.id,
                      label: jobPickLabel(j),
                      keywords: jobPickKeywords(j, publicJobPositionLabel(j)),
                    })),
                  ]}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>ประเภทเจาะจง</label>
              <FieldSelect
                ariaLabel="ประเภทเจาะจง"
                value={specificType}
                onChange={setSpecificType}
                options={[{ value: '', label: 'ไม่ระบุ' }, ...RM_SPECIFIC_TYPES.map((t) => ({ value: t, label: t }))]}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>วุฒิการศึกษา</label>
              <FieldSelect
                ariaLabel="วุฒิการศึกษา"
                value={education}
                onChange={setEducation}
                options={[{ value: '', label: 'ไม่ระบุ' }, ...RM_EDUCATION_LEVELS.map((d) => ({ value: d, label: d }))]}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>ผู้รับผิดชอบ</label>
              <FieldSelect
                ariaLabel="ผู้รับผิดชอบ"
                value={responsible}
                onChange={setResponsible}
                options={[{ value: '', label: 'ไม่ระบุ' }, ...staff.map((u) => ({ value: u.id, label: u.name }))]}
              />
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

          {/* ส่ง AI โทร หรือไม่ (21 ต.ค. 2569 · ต้องเลือก) — ไม่ส่ง = เข้าแท็บการติดต่อของคนเพิ่ม */}
          <div className="space-y-1.5" data-testid="add-applicant-call-mode">
            <label className={labelCls}>โทรหาผู้สมัคร *</label>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={callMode}
              onValueChange={(v) => (v === 'ai' || v === 'manual' ? setCallMode(v) : undefined)}
              aria-label="โทรหาผู้สมัคร"
              className="flex-wrap justify-start"
            >
              {/* ไม่ผูกหน่วยงาน = บทโทรเบื้องต้น (ยืนยันตัวตน · ยังหางานไหม · จังหวัด · อายุ — 21 ต.ค. 2569) */}
              <ToggleGroupItem value="ai">{jobPick === NO_JOB ? 'ส่ง AI โทรเบื้องต้น' : 'ส่ง AI โทร'}</ToggleGroupItem>
              <ToggleGroupItem value="manual">ไม่ส่ง · เก็บไปโทรเอง</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <PdpaConsentCheck checked={consent} onChange={setConsent} text={PDPA_CONSENT_TEXT_STAFF} />

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
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <UserPlus aria-hidden />
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
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-[38rem] flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <DialogHeader className="shrink-0 border-b border-border/50 px-5 py-4 text-left">
          <DialogTitle className="text-base font-medium">เพิ่มข้อมูลผู้สมัคร</DialogTitle>
          <DialogDescription className="text-xs">คนที่โทรเข้ามาสมัคร</DialogDescription>
        </DialogHeader>

        {body}
      </DialogContent>
    </Dialog>
  );
};

export default AddApplicantDialog;
