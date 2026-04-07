import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import type { JobCategory, JobRequest, JobType } from '@/types';
import { createJob, JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/demoStorage';
import { buildRecruiterNameOptions, buildScreenerNameOptions } from '@/lib/jobStaffNames';
import { RosterBackedStaffSelect } from '@/components/jobs/RosterBackedStaffSelect';
import { useAuth } from '@/contexts/AuthContext';
import { isDemoMode, enableRuntimeDemo } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';
import { apiUnreachableHint } from '@/lib/apiUnreachableHint';

const WORK_DAY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— เลือก —' },
  { value: 'mon', label: 'จันทร์' },
  { value: 'tue', label: 'อังคาร' },
  { value: 'wed', label: 'พุธ' },
  { value: 'thu', label: 'พฤหัสบดี' },
  { value: 'fri', label: 'ศุกร์' },
  { value: 'sat', label: 'เสาร์' },
  { value: 'sun', label: 'อาทิตย์' },
];

function workDayLabel(value: string): string {
  return WORK_DAY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30] as const) {
      if (h === 22 && m === 30) break;
      slots.push(`${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}`);
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

type VehicleAllow = 'ใช้ได้' | 'ใช้ไม่ได้';

function buildVehicleRequiredString(
  van: string,
  sedan: string,
  pickup: string,
): string | undefined {
  const parts = [`รถตู้: ${van}`, `รถเก๋ง: ${sedan}`, `รถกระบะ: ${pickup}`];
  return parts.join(' · ');
}

function buildWorkScheduleString(
  dayFrom: string,
  dayTo: string,
  timeFrom: string,
  timeTo: string,
): string | undefined {
  const daySeg =
    dayFrom && dayTo
      ? `วันทำงาน: ${workDayLabel(dayFrom)} ถึง ${workDayLabel(dayTo)}`
      : dayFrom || dayTo
        ? `วันทำงาน: ${workDayLabel(dayFrom || dayTo)}`
        : '';
  const timeSeg =
    timeFrom && timeTo ? `เวลา: ${timeFrom} ถึง ${timeTo}` : timeFrom || timeTo ? `เวลา: ${timeFrom || timeTo}` : '';
  const out = [daySeg, timeSeg].filter(Boolean).join(' | ');
  return out || undefined;
}

const AddJobPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManageStaffRoster = hasPermission('admin');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [unitName, setUnitName] = useState('');
  const [requestDate, setRequestDate] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [jobType, setJobType] = useState<JobType>('thai_executive');
  const [jobCategory, setJobCategory] = useState<JobCategory>('private');
  const [totalIncome, setTotalIncome] = useState('');
  const [recruiterName, setRecruiterName] = useState('');
  const [screenerName, setScreenerName] = useState('');
  const [staffRosterRev, setStaffRosterRev] = useState(0);
  const [staffJobs, setStaffJobs] = useState<JobRequest[]>([]);

  const recruiterOptions = useMemo(() => {
    void staffRosterRev;
    return buildRecruiterNameOptions(isDemoMode() ? undefined : staffJobs);
  }, [staffRosterRev, staffJobs]);
  const screenerOptions = useMemo(() => {
    void staffRosterRev;
    return buildScreenerNameOptions(isDemoMode() ? undefined : staffJobs);
  }, [staffRosterRev, staffJobs]);

  useEffect(() => {
    const fn = () => setStaffRosterRev((x) => x + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
  }, []);

  useEffect(() => {
    if (isDemoMode()) return;
    let cancelled = false;
    apiFetch('/api/jobs?limit=500')
      .then(async (r) => (r.ok ? ((await r.json()) as JobRequest[]) : []))
      .then((data) => {
        if (!cancelled) setStaffJobs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setStaffJobs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [houseNo, setHouseNo] = useState('');
  const [projectName, setProjectName] = useState('');
  const [road, setRoad] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [ageRangeMin, setAgeRangeMin] = useState('');
  const [ageRangeMax, setAgeRangeMax] = useState('');
  const [vehicleVan, setVehicleVan] = useState<VehicleAllow>('ใช้ได้');
  const [vehicleSedan, setVehicleSedan] = useState<VehicleAllow>('ใช้ได้');
  const [vehiclePickup, setVehiclePickup] = useState<VehicleAllow>('ใช้ได้');
  const [workDayFrom, setWorkDayFrom] = useState('');
  const [workDayTo, setWorkDayTo] = useState('');
  const [workTimeFrom, setWorkTimeFrom] = useState('');
  const [workTimeTo, setWorkTimeTo] = useState('');
  const [penaltyPerDay, setPenaltyPerDay] = useState('');

  const fullAddress = useMemo(() => {
    return [
      houseNo ? `เลขที่ ${houseNo.trim()}` : '',
      projectName ? `อาคาร/หมู่บ้าน/โครงการ ${projectName.trim()}` : '',
      road ? `ถนน ${road.trim()}` : '',
      subdistrict ? `ตำบล/แขวง ${subdistrict.trim()}` : '',
      district ? `อำเภอ/เขต ${district.trim()}` : '',
      province ? `จังหวัด ${province.trim()}` : '',
      postalCode ? `รหัสไปรษณีย์ ${postalCode.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }, [houseNo, projectName, road, subdistrict, district, province, postalCode]);

  const vehicleRequired = useMemo(
    () => buildVehicleRequiredString(vehicleVan, vehicleSedan, vehiclePickup),
    [vehicleVan, vehicleSedan, vehiclePickup],
  );
  const workSchedule = useMemo(
    () => buildWorkScheduleString(workDayFrom, workDayTo, workTimeFrom, workTimeTo),
    [workDayFrom, workDayTo, workTimeFrom, workTimeTo],
  );

  const handleSave = async () => {
    if (saving) return;
    setFormError(null);

    const normalizedUnitName = unitName.trim();
    if (!normalizedUnitName) {
      setFormError('กรุณากรอกชื่อหน่วยงาน');
      return;
    }
    if (!requestDate) {
      setFormError('กรุณาเลือกวันที่ขอ');
      return;
    }
    if (!requiredDate) {
      setFormError('กรุณาเลือกวันที่ต้องการ');
      return;
    }
    if (!houseNo.trim()) {
      setFormError('กรุณากรอกเลขที่สถานที่');
      return;
    }
    if (!subdistrict.trim()) {
      setFormError('กรุณากรอกตำบล/แขวง');
      return;
    }
    if (!district.trim()) {
      setFormError('กรุณากรอกอำเภอ/เขต');
      return;
    }
    if (!province.trim()) {
      setFormError('กรุณากรอกจังหวัด');
      return;
    }

    const totalIncomeNum = totalIncome.trim() ? Number(totalIncome.trim()) : 0;
    if (Number.isNaN(totalIncomeNum) || totalIncomeNum < 0) {
      setFormError('รายได้รวมต้องเป็นตัวเลขที่ถูกต้อง');
      return;
    }

    const penaltyNum = penaltyPerDay.trim() ? Number(penaltyPerDay.trim()) : 0;
    if (Number.isNaN(penaltyNum) || penaltyNum < 0) {
      setFormError('ค่าปรับ/วันต้องเป็นตัวเลขที่ถูกต้อง');
      return;
    }

    const payload = {
      unit_name: normalizedUnitName,
      request_date: requestDate,
      required_date: requiredDate,
      urgency: 'urgent' as const,
      total_income: Math.trunc(totalIncomeNum),
      location_address: fullAddress,
      job_type: jobType,
      job_category: jobCategory,
      recruiter_name: recruiterName.trim() || undefined,
      screener_name: screenerName.trim() || undefined,
      age_range_min: ageRangeMin.trim() ? Number(ageRangeMin.trim()) : undefined,
      age_range_max: ageRangeMax.trim() ? Number(ageRangeMax.trim()) : undefined,
      vehicle_required: vehicleRequired,
      work_schedule: workSchedule,
      penalty_per_day: Math.trunc(penaltyNum),
    };

    if (isDemoMode()) {
      setSaving(true);
      try {
        createJob({
          unit_name: payload.unit_name,
          request_date: payload.request_date,
          required_date: payload.required_date,
          urgency: payload.urgency,
          total_income: payload.total_income,
          location_address: payload.location_address,
          job_type: payload.job_type,
          job_category: payload.job_category,
          recruiter_name: payload.recruiter_name,
          screener_name: payload.screener_name,
          age_range_min: payload.age_range_min,
          age_range_max: payload.age_range_max,
          vehicle_required: payload.vehicle_required,
          work_schedule: payload.work_schedule,
          penalty_per_day: payload.penalty_per_day,
        });
        navigate('/jobs/list');
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      setSaving(true);
      const r = await apiFetch('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const body: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const fromApi =
          body &&
          typeof body === 'object' &&
          ('message' in body || 'error' in body)
            ? String(
                (body as { message?: string; error?: string }).message ||
                  (body as { error?: string }).error ||
                  '',
              ).trim()
            : '';
        setFormError(
          fromApi ||
            `บันทึกไม่สำเร็จ (HTTP ${r.status}) — ตรวจสอบ API และตาราง jarvis_rm.jobs`,
        );
        return;
      }
      navigate('/jobs/list');
    } catch (e) {
      if (e instanceof TypeError) {
        enableRuntimeDemo();
        try {
          createJob({
            unit_name: payload.unit_name,
            request_date: payload.request_date,
            required_date: payload.required_date,
            urgency: payload.urgency,
            total_income: payload.total_income,
            location_address: payload.location_address,
            job_type: payload.job_type,
            job_category: payload.job_category,
            recruiter_name: payload.recruiter_name,
            screener_name: payload.screener_name,
            age_range_min: payload.age_range_min,
            age_range_max: payload.age_range_max,
            vehicle_required: payload.vehicle_required,
            work_schedule: payload.work_schedule,
            penalty_per_day: payload.penalty_per_day,
          });
          toast.success('บันทึกแล้ว (สลับเป็นโหมดสาธิต — เก็บในเครื่องนี้เพราะต่อ API ไม่ได้)');
          navigate('/jobs/list');
        } catch {
          setFormError(apiUnreachableHint());
        }
      } else {
        setFormError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="สร้างงานใหม่" backPath="/jobs" />

      <div className="px-4 md:px-6">
        <div className="glass-card rounded-xl p-4 md:p-6 border border-border max-w-3xl space-y-4">
          {formError && <div className="text-sm text-destructive">{formError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ชื่อหน่วยงาน *</label>
              <input
                type="text"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่ขอ *</label>
              <input
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่ต้องการ *</label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ลักษณะงาน *</label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value as JobType)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                <option value="thai_executive">ผู้บริหารคนไทย</option>
                <option value="foreign_executive">ผู้บริหารต่างชาติ</option>
                <option value="central">ส่วนกลาง</option>
                <option value="valet_parking">Valet Parking</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ประเภทงาน *</label>
              <select
                value={jobCategory}
                onChange={(e) => setJobCategory(e.target.value as JobCategory)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                <option value="private">เอกชน</option>
                <option value="government">ราชการ</option>
                <option value="bank">ธนาคาร</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">รายได้รวม</label>
              <input
                type="number"
                value={totalIncome}
                onChange={(e) => setTotalIncome(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>

            <RosterBackedStaffSelect
              role="recruiter"
              label="เจ้าหน้าที่สรรหา"
              value={recruiterName}
              onChange={setRecruiterName}
              optionNames={recruiterOptions}
              canManageRoster={canManageStaffRoster}
              rosterRev={staffRosterRev}
            />

            <RosterBackedStaffSelect
              role="screener"
              label="เจ้าหน้าที่คัดสรร"
              value={screenerName}
              onChange={setScreenerName}
              optionNames={screenerOptions}
              canManageRoster={canManageStaffRoster}
              rosterRev={staffRosterRev}
            />
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">สถานที่ปฏิบัติงาน</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">เลขที่ *</label>
                <input
                  type="text"
                  value={houseNo}
                  onChange={(e) => setHouseNo(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">อาคาร / หมู่บ้าน / โครงการ</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ถนน</label>
                <input
                  type="text"
                  value={road}
                  onChange={(e) => setRoad(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ตำบล / แขวง *</label>
                <input
                  type="text"
                  value={subdistrict}
                  onChange={(e) => setSubdistrict(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">อำเภอ / เขต *</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">จังหวัด *</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">รหัสไปรษณีย์</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ที่อยู่รวม (บันทึก)</label>
                <div className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground min-h-[42px]">
                  {fullAddress || '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">รายละเอียดเพิ่มเติม</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ช่วงอายุ</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={ageRangeMin}
                    onChange={(e) => setAgeRangeMin(e.target.value)}
                    placeholder="ต่ำสุด"
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                  <input
                    type="number"
                    value={ageRangeMax}
                    onChange={(e) => setAgeRangeMax(e.target.value)}
                    placeholder="สูงสุด"
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                </div>
              </div>

              <div className="md:col-span-2 space-y-3">
                <label className="text-xs font-medium text-muted-foreground block">รถที่ใช้</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">รถตู้</label>
                    <select
                      value={vehicleVan}
                      onChange={(e) => setVehicleVan(e.target.value as VehicleAllow)}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                    >
                      <option value="ใช้ได้">ใช้ได้</option>
                      <option value="ใช้ไม่ได้">ใช้ไม่ได้</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">รถเก๋ง</label>
                    <select
                      value={vehicleSedan}
                      onChange={(e) => setVehicleSedan(e.target.value as VehicleAllow)}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                    >
                      <option value="ใช้ได้">ใช้ได้</option>
                      <option value="ใช้ไม่ได้">ใช้ไม่ได้</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">รถกระบะ</label>
                    <select
                      value={vehiclePickup}
                      onChange={(e) => setVehiclePickup(e.target.value as VehicleAllow)}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                    >
                      <option value="ใช้ได้">ใช้ได้</option>
                      <option value="ใช้ไม่ได้">ใช้ไม่ได้</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  บันทึกรวม: {vehicleRequired}
                </p>
              </div>

              <div className="md:col-span-2 space-y-3">
                <label className="text-xs font-medium text-muted-foreground block">วันเวลาทำงาน</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[11px] text-muted-foreground">วันทำงาน (ตั้งแต่ – ถึง)</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={workDayFrom}
                        onChange={(e) => setWorkDayFrom(e.target.value)}
                        className="flex-1 min-w-[120px] bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                      >
                        {WORK_DAY_OPTIONS.map((o) => (
                          <option key={`f-${o.value || 'empty'}`} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground shrink-0">ถึง</span>
                      <select
                        value={workDayTo}
                        onChange={(e) => setWorkDayTo(e.target.value)}
                        className="flex-1 min-w-[120px] bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                      >
                        {WORK_DAY_OPTIONS.map((o) => (
                          <option key={`t-${o.value || 'empty'}`} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] text-muted-foreground">เวลา (ตั้งแต่ – ถึง)</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={workTimeFrom}
                        onChange={(e) => setWorkTimeFrom(e.target.value)}
                        className="flex-1 min-w-[100px] bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                      >
                        <option value="">— เลือก —</option>
                        {TIME_SLOTS.map((t) => (
                          <option key={`tf-${t}`} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground shrink-0">ถึง</span>
                      <select
                        value={workTimeTo}
                        onChange={(e) => setWorkTimeTo(e.target.value)}
                        className="flex-1 min-w-[100px] bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                      >
                        <option value="">— เลือก —</option>
                        {TIME_SLOTS.map((t) => (
                          <option key={`tt-${t}`} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {workSchedule ? `บันทึกรวม: ${workSchedule}` : 'ยังไม่เลือกวัน/เวลา (ไม่บังคับ)'}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ค่าปรับ / วัน</label>
                <input
                  type="number"
                  value={penaltyPerDay}
                  onChange={(e) => setPenaltyPerDay(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="px-6 py-2.5 rounded-lg bg-secondary text-foreground font-medium text-sm"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddJobPage;
