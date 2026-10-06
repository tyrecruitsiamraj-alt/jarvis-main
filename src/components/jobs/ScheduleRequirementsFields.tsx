import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveUnitFieldOverridesPatch, unitRequestNoteKey } from '@/lib/siamrajUnitRequestsApi';
import { cleanRequirementLines, POST_SCHEDULE_MAX } from '@/lib/postText';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';

/**
 * ═══ วันเวลาทำงาน + คุณสมบัติ — หน้า 3 ของป๊อปประกาศ (6 ต.ค. 2569) ═══
 * ช่องใหม่คู่กับ "วางข้อความโพสต์" — วางแล้วเติมให้ แก้ต่อเองได้ที่นี่
 * - วันเวลาทำงาน: ค่าตั้งต้น = ใบขอ (ERP) · แก้แล้วเก็บ `field_overrides.work_schedule` ทับเฉพาะที่โชว์บนประกาศ
 * - คุณสมบัติ: บรรทัดละข้อ เก็บ `field_overrides.requirements`
 * - รายละเอียดงาน (6 ต.ค. 2569): จุดรับนาย · จุดส่งนาย · รถที่ใช้ — บรรทัดละข้อ เก็บ `field_overrides.job_details`
 * 🔴 กด "บันทึก" เอง (เลิก auto-save ทั้งระบบ) · บันทึกเฉพาะช่องที่แก้ — ไม่แก้วันเวลา = ไม่แช่ค่า ERP ลงฐาน
 */
export default function ScheduleRequirementsFields({
  job,
  onSaved,
}: {
  job: JobRequest;
  onSaved: (patch: Partial<JobRequest>) => void;
}) {
  const initSchedule = (job.work_schedule ?? '').trim();
  const initReq = (job.requirements ?? []).join('\n');
  const initDet = (job.job_details ?? []).join('\n');
  const [schedule, setSchedule] = React.useState(initSchedule);
  const [req, setReq] = React.useState(initReq);
  const [det, setDet] = React.useState(initDet);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const id = React.useId();

  React.useEffect(() => {
    setSchedule(initSchedule);
    setReq(initReq);
    setDet(initDet);
  }, [initSchedule, initReq, initDet]);

  const scheduleDirty = schedule.trim() !== initSchedule;
  const reqDirty = req.trim() !== initReq.trim();
  const detDirty = det.trim() !== initDet.trim();

  const save = async () => {
    const requestNo = unitRequestNoteKey(job);
    if (!requestNo) {
      setError('ใบขอนี้ไม่มีเลขที่ใบขอ บันทึกไม่ได้');
      return;
    }
    const lines = cleanRequirementLines(req.split('\n'));
    const detLines = cleanRequirementLines(det.split('\n'));
    const patch: { work_schedule?: string | null; requirements?: string[] | null; job_details?: string[] | null } = {};
    if (scheduleDirty) patch.work_schedule = schedule.trim().slice(0, POST_SCHEDULE_MAX) || null;
    if (reqDirty) patch.requirements = lines.length > 0 ? lines : null;
    if (detDirty) patch.job_details = detLines.length > 0 ? detLines : null;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await saveUnitFieldOverridesPatch(requestNo, patch);
      onSaved({
        field_overrides: next as JobRequest['field_overrides'],
        ...(scheduleDirty ? { work_schedule: patch.work_schedule ?? '' } : {}),
        ...(reqDirty ? { requirements: lines } : {}),
        ...(detDirty ? { job_details: detLines } : {}),
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${id}-schedule`} className="text-xs text-muted-foreground">
          วันเวลาทำงาน
        </Label>
        <Input
          id={`${id}-schedule`}
          value={schedule}
          maxLength={POST_SCHEDULE_MAX}
          onChange={(e) => {
            setSchedule(e.target.value);
            setSaved(false);
          }}
          placeholder="เช่น จ.-ศ. เวลา 08.00-17.00 น."
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-det`} className="text-xs text-muted-foreground">
          รายละเอียดงาน · บรรทัดละข้อ
        </Label>
        <Textarea
          id={`${id}-det`}
          value={det}
          rows={3}
          onChange={(e) => {
            setDet(e.target.value);
            setSaved(false);
          }}
          placeholder="เช่น รับนาย ลาดพร้าว"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-req`} className="text-xs text-muted-foreground">
          คุณสมบัติ · บรรทัดละข้อ
        </Label>
        <Textarea
          id={`${id}-req`}
          value={req}
          rows={4}
          onChange={(e) => {
            setReq(e.target.value);
            setSaved(false);
          }}
          placeholder="เช่น มีประสบการณ์ 1 ปีขึ้นไป"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" disabled={busy || (!scheduleDirty && !reqDirty && !detDirty)} onClick={() => void save()}>
          {busy ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
        {saved ? <span className={cn('text-sm', TONE.success.value)}>บันทึกแล้ว</span> : null}
        {error ? (
          <span role="alert" className={cn('text-sm', TONE.danger.value)}>
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
