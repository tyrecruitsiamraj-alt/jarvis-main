import { useEffect, useMemo, useState } from 'react';
import { listStaffContactsCached, type FollowStaffContact } from '@/lib/followStaffContactsApi';
import { getJobStaffApiCache, JOB_STAFF_ROSTER_CHANGED_EVENT, refreshJobStaffFromApi } from '@/lib/jobStaffRemote';
import { followStaffDirectory, staffNameForPhone } from '@/lib/followStaffMemory';

/**
 * เบอร์เจ้าหน้าที่ → ชื่อ (สมุดเบอร์หน้าผู้ใช้งานก่อน แล้วค่อยความจำเดิม) — ตัวเดียวกับช่อง "เจ้าหน้าที่ที่ติดตาม"
 * ใช้กับตัวกรองเจ้าของงานของหน้าการติดตาม (4 ต.ค. 2569)
 */
export function useFollowStaffNameOf(): (phone: string) => string | null {
  const [contacts, setContacts] = useState<FollowStaffContact[]>([]);
  const [rosterRev, setRosterRev] = useState(0);

  useEffect(() => {
    void refreshJobStaffFromApi();
    const onRoster = () => setRosterRev((r) => r + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, onRoster);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, onRoster);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listStaffContactsCached()
      .then((v) => {
        if (!cancelled) setContacts(v);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    void rosterRev;
    const directory = followStaffDirectory(getJobStaffApiCache()?.directory ?? []);
    return (phone: string) => staffNameForPhone(phone, directory, contacts);
  }, [rosterRev, contacts]);
}
