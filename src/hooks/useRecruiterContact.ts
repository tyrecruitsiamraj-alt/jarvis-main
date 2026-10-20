import { useEffect, useMemo, useState } from 'react';
import { getJobStaffApiCache, JOB_STAFF_ROSTER_CHANGED_EVENT, refreshJobStaffFromApi } from '@/lib/jobStaffRemote';
import { formatRecruiterPhone } from '@/lib/recruiterContact';

/**
 * เบอร์เจ้าหน้าที่สรรหาของใบขอ (ชื่อเล่นใน `recruiter_name`) จากสมุดเบอร์หน้าผู้ใช้งาน (/api/job-staff)
 * ใช้กับการ์ดตัวอย่าง "ผู้สมัครจะเห็นแบบนี้" ให้ตรงกับหน้า /apply (เจ้าของ 20 ต.ค. 2569) · ไม่มีเบอร์ = null
 */
export function useRecruiterContact(name: string | null | undefined): { name: string; phone: string } | null {
  const [rev, setRev] = useState(0);
  const wanted = Boolean((name ?? '').trim());
  useEffect(() => {
    // ไม่มีชื่อให้หา (เช่นหน้า /apply ที่ API แนบเบอร์มาแล้ว) = ไม่ยิงสมุดเบอร์ของเจ้าหน้าที่
    if (!wanted) return;
    if (!getJobStaffApiCache()) void refreshJobStaffFromApi();
    const on = () => setRev((r) => r + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, on);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, on);
  }, [wanted]);
  return useMemo(() => {
    void rev;
    const key = (name ?? '').trim().toLowerCase();
    if (!key) return null;
    const hit = (getJobStaffApiCache()?.directory ?? []).find((d) => d.name.trim().toLowerCase() === key);
    const phone = formatRecruiterPhone(hit?.phone);
    return hit && phone ? { name: hit.name.trim(), phone } : null;
  }, [name, rev]);
}
