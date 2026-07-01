import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { RosterBackedStaffSelect } from '@/components/jobs/RosterBackedStaffSelect';
import { fetchSiamrajUnitRequest, saveSiamrajUnitAssignment } from '@/lib/siamrajUnitRequestsApi';
import { buildRecruiterNameOptions, buildScreenerNameOptions } from '@/lib/jobStaffNames';
import { refreshJobStaffFromApi } from '@/lib/jobStaffRemote';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/demoStorage';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { Database, ExternalLink, Users } from 'lucide-react';

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

const SiamrajUnitRequestDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['siamraj', 'unit-request', id],
    queryFn: () => fetchSiamrajUnitRequest(id),
    enabled: !!id,
  });

  const [recruiter, setRecruiter] = useState('');
  const [screener, setScreener] = useState('');
  const [rosterRev, setRosterRev] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // โหลดรายชื่อสรรหา/คัดสรรจาก roster + ฟังการเปลี่ยนแปลง
  useEffect(() => {
    void refreshJobStaffFromApi();
    const onRoster = () => setRosterRev((r) => r + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, onRoster);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, onRoster);
  }, []);

  // seed ค่าผู้รับผิดชอบจากข้อมูลที่โหลดมา
  useEffect(() => {
    setRecruiter(data?.recruiter_name ?? '');
    setScreener(data?.screener_name ?? '');
    setSaveMsg(null);
  }, [data?.recruiter_name, data?.screener_name]);

  const recruiterOptions = useMemo(() => {
    void rosterRev;
    return buildRecruiterNameOptions();
  }, [rosterRev]);
  const screenerOptions = useMemo(() => {
    void rosterRev;
    return buildScreenerNameOptions();
  }, [rosterRev]);

  const requestNo = data?.request_no;
  const dirty =
    (recruiter.trim() || '') !== (data?.recruiter_name ?? '') ||
    (screener.trim() || '') !== (data?.screener_name ?? '');

  const saveAssignment = async () => {
    if (!requestNo || saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveSiamrajUnitAssignment(requestNo, {
        recruiter_name: recruiter.trim() || null,
        screener_name: screener.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['siamraj', 'unit-request', id] });
      setSaveMsg('บันทึกผู้รับผิดชอบแล้ว');
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="รายละเอียดใบขอ"
        subtitle={data?.request_no || 'อ่านจาก Siamraj'}
        backPath="/jobs"
        actions={
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-700">
            <Database className="w-3.5 h-3.5" />
            Siamraj · อ่านอย่างเดียว
          </span>
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
        {error && (
          <p className="text-sm text-destructive rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
            {error instanceof Error ? error.message : String(error)}
          </p>
        )}

        {data && (
          <>
            <div className="glass-card rounded-[1.5rem] p-4 border border-white/70 flex flex-wrap items-center gap-2">
              <StatusBadge status={data.status} type="job" />
              {data.request_action_name ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground">
                  {data.request_action_name}
                </span>
              ) : null}
              {data.siamraj_status ? (
                <span className="text-xs text-muted-foreground">สถานะ ST: {data.siamraj_status}</span>
              ) : null}
            </div>

            <section className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4 text-blue-600" />
                ข้อมูลใบขอ
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                <Field label="เลขที่ใบขอ" value={data.request_no} />
                <Field label="ชื่อผู้ส่ง" value={data.submittedByName} />
                <Field
                  label="วัน/เวลาที่ส่ง"
                  value={data.submittedAt ? new Date(data.submittedAt).toLocaleString('th-TH') : undefined}
                />
                <Field label="วันที่ต้องการ" value={formatYmdDmyBe(data.required_date)} />
                <Field label="ทำงานวันสุดท้าย" value={data.lastWorkingDay ? formatYmdDmyBe(data.lastWorkingDay) : undefined} />
                <Field label="ชื่อหน่วยงาน" value={data.unit_name} />
                <Field label="รหัสไซต์" value={data.site_code || data.unit_name} />
                <Field label="สถานที่ทำงาน" value={data.location_address} />
                <Field label="ลักษณะงาน" value={data.job_description_code_1} />
                <Field label="ตำแหน่ง (รายละเอียด)" value={data.staff_title_name || data.job_description_code_2} />
                <Field
                  label="ช่วงอายุ"
                  value={
                    data.age_range_min != null || data.age_range_max != null
                      ? `${data.age_range_min ?? '—'} – ${data.age_range_max ?? '—'} ปี`
                      : undefined
                  }
                />
                <Field label="เพศ" value={data.gender_requirement} />
                <Field label="ประเภทใบขอ" value={data.request_action_name} />
                <Field label="ชื่อคนลาออก" value={data.resigned_employee_name} />
                <Field label="สาเหตุที่ลาออก" value={data.resigned_reason} />
                <Field label="รายได้ (อัตราจ่าย)" value={data.total_income ? `฿${data.total_income.toLocaleString()}` : undefined} />
                <Field label="วันเวลาเข้างาน" value={data.work_schedule} />
                <Field label="ชื่อผู้ติดต่อหน่วยงาน" value={data.contact_name} />
                <Field label="เบอร์ติดต่อ" value={data.contact_phone} />
              </div>
            </section>

            <section className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                ผู้รับผิดชอบ
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <RosterBackedStaffSelect
                  role="recruiter"
                  label="เจ้าหน้าที่สรรหา"
                  value={recruiter}
                  onChange={setRecruiter}
                  optionNames={recruiterOptions}
                  canManageRoster={false}
                  rosterRev={rosterRev}
                />
                <RosterBackedStaffSelect
                  role="screener"
                  label="เจ้าหน้าที่คัดสรร"
                  value={screener}
                  onChange={setScreener}
                  optionNames={screenerOptions}
                  canManageRoster={false}
                  rosterRev={rosterRev}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void saveAssignment()}
                  disabled={saving || !requestNo || !dirty}
                  className="jarvis-pill-btn text-sm px-4 py-2 disabled:opacity-50"
                >
                  {saving ? 'กำลังบันทึก…' : 'บันทึกผู้รับผิดชอบ'}
                </button>
                {saveMsg && <span className="text-xs text-muted-foreground">{saveMsg}</span>}
                {!requestNo && (
                  <span className="text-xs text-destructive">ใบขอนี้ไม่มีเลขที่ใบขอ จึงบันทึกไม่ได้</span>
                )}
              </div>
            </section>

            <section className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-2">
              <h3 className="text-sm font-semibold">ผู้ลาออก / ตำแหน่ง</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                <Field label="ชื่อคนลาออก" value={data.resigned_employee_name} />
                <Field label="สาเหตุที่ลาออก" value={data.resigned_reason} />
                <Field label="รุ่น/ประเภทรถ" value={data.vehicle_required} />
                <Field label="เบอร์ติดต่อ" value={data.contact_phone} />
              </div>
            </section>

            <p className="text-xs text-muted-foreground">
              ข้อมูลมาจาก schema so-operation บน Siamraj — Jarvis อ่านอย่างเดียว แก้ไขที่ระบบต้นทาง
            </p>

            <button
              type="button"
              onClick={() => navigate('/jobs/list')}
              className="jarvis-pill-btn text-sm px-4 py-2"
            >
              กลับรายการ
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SiamrajUnitRequestDetailPage;
