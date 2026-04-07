import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CANDIDATE_STATUS_LABELS,
  type Candidate,
  type CandidateStaffingTrack,
  type CandidateStatus,
  type DrivingResult,
  type Gender,
  type YesNo,
} from '@/types';
import { CANDIDATE_STAFFING_OPTIONS } from '@/lib/candidateStaffing';
import { isDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';
import { upsertCandidateInDemoStorage, hydrateCandidateStaffing } from '@/lib/demoStorage';

const TITLE_PREFIX_SELECT = [
  { value: '', label: '— ไม่มี —' },
  { value: 'นาย', label: 'นาย' },
  { value: 'นาง', label: 'นาง' },
  { value: 'นางสาว', label: 'นางสาว' },
  { value: 'เด็กชาย', label: 'เด็กชาย' },
  { value: 'เด็กหญิง', label: 'เด็กหญิง' },
  { value: '__custom__', label: 'อื่น ๆ (พิมพ์เอง)' },
] as const;

type FormState = {
  title_prefix_select: string;
  title_prefix_custom: string;
  first_name: string;
  last_name: string;
  phone: string;
  age: string;
  gender: Gender;
  drinking: YesNo;
  smoking: YesNo;
  tattoo: YesNo;
  van_driving: DrivingResult;
  sedan_driving: DrivingResult;
  address: string;
  application_date: string;
  first_contact_date: string;
  first_work_date: string;
  status: CandidateStatus;
  staffing_track: CandidateStaffingTrack;
  responsible_recruiter: string;
  risk_percentage: string;
};

function candidateToForm(c: Candidate): FormState {
  const tp = c.title_prefix?.trim() ?? '';
  let title_prefix_select = '';
  let title_prefix_custom = '';
  const fixed = TITLE_PREFIX_SELECT.find((o) => o.value === tp && o.value !== '__custom__');
  if (fixed) {
    title_prefix_select = tp;
  } else if (tp) {
    title_prefix_select = '__custom__';
    title_prefix_custom = tp;
  }

  return {
    title_prefix_select,
    title_prefix_custom,
    first_name: c.first_name,
    last_name: c.last_name,
    phone: c.phone,
    age: String(c.age),
    gender: c.gender,
    drinking: c.drinking,
    smoking: c.smoking,
    tattoo: c.tattoo,
    van_driving: c.van_driving,
    sedan_driving: c.sedan_driving,
    address: c.address,
    application_date: (c.application_date || '').slice(0, 10),
    first_contact_date: (c.first_contact_date || '').slice(0, 10),
    first_work_date: (c.first_work_date || '').slice(0, 10),
    status: c.status,
    staffing_track: c.staffing_track === 'wl' || c.staffing_track === 'ex' ? c.staffing_track : 'regular',
    responsible_recruiter: c.responsible_recruiter ?? '',
    risk_percentage: String(c.risk_percentage ?? 0),
  };
}

export type CandidateEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate | null;
  onSaved: (updated: Candidate) => void;
};

export const CandidateEditDialog: React.FC<CandidateEditDialogProps> = ({
  open,
  onOpenChange,
  candidate,
  onSaved,
}) => {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && candidate) {
      setForm(candidateToForm(candidate));
      setError(null);
    }
    if (!open) {
      setForm(null);
      setError(null);
    }
  }, [open, candidate]);

  const handleSave = async () => {
    if (!candidate || !form) return;
    setError(null);

    const tp =
      form.title_prefix_select === '__custom__'
        ? form.title_prefix_custom.trim()
        : form.title_prefix_select.trim();

    if (!form.first_name.trim()) {
      setError('กรุณากรอกชื่อ');
      return;
    }
    if (!form.last_name.trim()) {
      setError('กรุณากรอกนามสกุล');
      return;
    }
    if (!form.phone.trim()) {
      setError('กรุณากรอกเบอร์โทร');
      return;
    }
    const ageNum = parseInt(form.age, 10);
    if (!Number.isFinite(ageNum) || ageNum <= 0) {
      setError('กรุณากรอกอายุให้ถูกต้อง');
      return;
    }
    if (!form.address.trim()) {
      setError('กรุณากรอกที่อยู่');
      return;
    }

    const risk = Math.min(100, Math.max(0, parseInt(form.risk_percentage, 10) || 0));

    setSaving(true);
    try {

      const next: Candidate = {
        id: candidate.id,
        created_at: candidate.created_at,
        lat: candidate.lat,
        lng: candidate.lng,
        ...(tp ? { title_prefix: tp } : {}),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        age: Math.trunc(ageNum),
        gender: form.gender,
        drinking: form.drinking,
        smoking: form.smoking,
        tattoo: form.tattoo,
        van_driving: form.van_driving,
        sedan_driving: form.sedan_driving,
        address: form.address.trim(),
        application_date:
          form.application_date.trim() ||
          (candidate.application_date || '').slice(0, 10) ||
          new Date().toISOString().slice(0, 10),
        ...(form.first_contact_date.trim()
          ? { first_contact_date: form.first_contact_date.trim() }
          : {}),
        ...(form.first_work_date.trim() ? { first_work_date: form.first_work_date.trim() } : {}),
        status: form.status,
        staffing_track: form.staffing_track,
        ...(form.responsible_recruiter.trim()
          ? { responsible_recruiter: form.responsible_recruiter.trim() }
          : {}),
        risk_percentage: risk,
      };

      if (isDemoMode()) {
        upsertCandidateInDemoStorage(next);
        onSaved(hydrateCandidateStaffing(next));
        onOpenChange(false);
        return;
      }

      const body: Record<string, unknown> = {
        id: next.id,
        first_name: next.first_name,
        last_name: next.last_name,
        phone: next.phone,
        age: next.age,
        gender: next.gender,
        drinking: next.drinking,
        smoking: next.smoking,
        tattoo: next.tattoo,
        van_driving: next.van_driving,
        sedan_driving: next.sedan_driving,
        address: next.address,
        application_date: next.application_date,
        status: next.status,
        staffing_track: next.staffing_track,
        risk_percentage: next.risk_percentage,
        lat: next.lat ?? null,
        lng: next.lng ?? null,
        title_prefix: tp || '',
      };
      if (next.first_contact_date) body.first_contact_date = next.first_contact_date;
      if (next.first_work_date) body.first_work_date = next.first_work_date;
      if (next.responsible_recruiter) body.responsible_recruiter = next.responsible_recruiter;

      const r = await apiFetch('/api/candidates', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      let data: unknown = {};
      try {
        data = await r.json();
      } catch {
        /* ignore */
      }
      if (!r.ok) {
        const rec = data as { message?: string };
        const msg =
          typeof rec.message === 'string'
            ? rec.message
            : r.status === 403
              ? 'ไม่มีสิทธิ์แก้ไข'
              : 'บันทึกไม่สำเร็จ';
        throw new Error(msg);
      }
      const updated = data as Candidate;
      if (updated?.id) {
        onSaved(hydrateCandidateStaffing(updated));
        onOpenChange(false);
      } else {
        throw new Error('คำตอบจากเซิร์ฟเวอร์ไม่ถูกต้อง');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(90vh,760px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขข้อมูลผู้สมัคร</DialogTitle>
          <DialogDescription>อัปเดตรายละเอียดและบันทึก</DialogDescription>
        </DialogHeader>
        {form && (
          <div className="space-y-3 pt-1">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">คำนำหน้า</label>
                <select
                  value={form.title_prefix_select}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      title_prefix_select: e.target.value,
                      title_prefix_custom: e.target.value === '__custom__' ? form.title_prefix_custom : '',
                    })
                  }
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                >
                  {TITLE_PREFIX_SELECT.map((opt) => (
                    <option key={opt.value || 'none'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {form.title_prefix_select === '__custom__' && (
                  <input
                    type="text"
                    value={form.title_prefix_custom}
                    onChange={(e) => setForm({ ...form, title_prefix_custom: e.target.value })}
                    placeholder="พิมพ์คำนำหน้า"
                    className="mt-1 w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ชื่อ *</label>
                <input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">นามสกุล *</label>
                <input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">เบอร์โทร *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">อายุ *</label>
                <input
                  type="number"
                  min={1}
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">เพศ *</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                >
                  <option value="male">ชาย</option>
                  <option value="female">หญิง</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ดื่ม</label>
                <select
                  value={form.drinking}
                  onChange={(e) => setForm({ ...form, drinking: e.target.value as YesNo })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                >
                  <option value="no">ไม่ดื่ม</option>
                  <option value="yes">ดื่ม</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">สูบ</label>
                <select
                  value={form.smoking}
                  onChange={(e) => setForm({ ...form, smoking: e.target.value as YesNo })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                >
                  <option value="no">ไม่สูบ</option>
                  <option value="yes">สูบ</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">รอยสัก</label>
                <select
                  value={form.tattoo}
                  onChange={(e) => setForm({ ...form, tattoo: e.target.value as YesNo })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                >
                  <option value="no">ไม่มี</option>
                  <option value="yes">มี</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ขับรถตู้</label>
                <select
                  value={form.van_driving}
                  onChange={(e) => setForm({ ...form, van_driving: e.target.value as DrivingResult })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                >
                  <option value="not_tested">ยังไม่สอบ</option>
                  <option value="passed">ผ่าน</option>
                  <option value="failed">ไม่ผ่าน</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ขับรถเก๋ง</label>
                <select
                  value={form.sedan_driving}
                  onChange={(e) => setForm({ ...form, sedan_driving: e.target.value as DrivingResult })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                >
                  <option value="not_tested">ยังไม่สอบ</option>
                  <option value="passed">ผ่าน</option>
                  <option value="failed">ไม่ผ่าน</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ที่อยู่ *</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={3}
                className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm resize-y min-h-[72px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่สมัคร</label>
                <input
                  type="date"
                  value={form.application_date}
                  onChange={(e) => setForm({ ...form, application_date: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">คุยครั้งแรก</label>
                <input
                  type="date"
                  value={form.first_contact_date}
                  onChange={(e) => setForm({ ...form, first_contact_date: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ลงงานครั้งแรก</label>
                <input
                  type="date"
                  value={form.first_work_date}
                  onChange={(e) => setForm({ ...form, first_work_date: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะ</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as CandidateStatus })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                >
                  {(Object.keys(CANDIDATE_STATUS_LABELS) as CandidateStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {CANDIDATE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ประเภทบุคลากร</label>
                <select
                  value={form.staffing_track}
                  onChange={(e) =>
                    setForm({ ...form, staffing_track: e.target.value as CandidateStaffingTrack })
                  }
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                >
                  {CANDIDATE_STAFFING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">เจ้าหน้าที่สรรหา (ผู้รับผิดชอบ)</label>
                <input
                  value={form.responsible_recruiter}
                  onChange={(e) => setForm({ ...form, responsible_recruiter: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Risk % (0–100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.risk_percentage}
                  onChange={(e) => setForm({ ...form, risk_percentage: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-3 py-2 rounded-lg text-sm border border-border bg-secondary"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
