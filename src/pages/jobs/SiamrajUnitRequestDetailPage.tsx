import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { fetchSiamrajUnitRequest } from '@/lib/siamrajUnitRequestsApi';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { Database, ExternalLink } from 'lucide-react';

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

  const { data, isLoading, error } = useQuery({
    queryKey: ['siamraj', 'unit-request', id],
    queryFn: () => fetchSiamrajUnitRequest(id),
    enabled: !!id,
  });

  return (
    <div>
      <PageHeader
        title="รายละเอียดใบขอ"
        subtitle={data?.request_no || 'อ่านจาก Siamraj'}
        backPath="/jobs"
        actions={
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-500/15 text-orange-700">
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
                <ExternalLink className="w-4 h-4 text-orange-600" />
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
                <Field label="ประเภทใบขอ" value={data.request_action_name} />
                <Field label="ชื่อคนลาออก" value={data.resigned_employee_name} />
                <Field label="สาเหตุที่ลาออก" value={data.resigned_reason} />
                <Field label="รายได้ (อัตราจ่าย)" value={data.total_income ? `฿${data.total_income.toLocaleString()}` : undefined} />
                <Field label="วันเวลาเข้างาน" value={data.work_schedule} />
                <Field label="ชื่อผู้ติดต่อหน่วยงาน" value={data.contact_name} />
                <Field label="เบอร์ติดต่อ" value={data.contact_phone} />
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
