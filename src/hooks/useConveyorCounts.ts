/**
 * ตัวเลขท้ายเมนูสายพาน — โหลดครั้งเดียวแล้วใช้ร่วมทุกหน้า
 *
 * 🔴 **ทำไมต้องมี cache ระดับโมดูล** — แถบเมนูอยู่บน `AppLayout` ซึ่งอยู่ทุกหน้า
 * ปล่อยให้ยิงใหม่ทุกครั้งที่เปลี่ยนหน้า = ยิง `/api/flow-summary` (ซึ่งแตะ ERP MSSQL)
 * ทุกคลิกเมนู · เส้นนั้นวัดแล้ว 600–900 ms ⇒ เมนูจะกลายเป็นตัวถ่วงของทั้งระบบ
 *
 * 🔴 **โหลดไม่ได้ = ไม่มีป้าย ไม่ใช่ป้าย 0** — `null` เดินทางถึงจอตามความจริง
 * (กติกาเดิมของหน้าแรก: 0 ที่รู้จริงกับ "ยังไม่รู้" คนละเรื่อง · วาด 0 ทั้งที่ไม่รู้
 * = จอบอกว่างานหมดแล้ว ซึ่งแย่กว่าจอที่เงียบ)
 */
import { useEffect, useState } from 'react';
import { fetchFlowSummary } from '@/lib/flowSummaryApi';
import { fetchOfficeFloor } from '@/lib/officeFloorApi';
import type { ConveyorCounts } from '@/lib/soRecruitNav';

/** อายุของค่าที่ถือไว้ — สั้นพอให้ตัวเลขไม่ค้างทั้งวัน ยาวพอให้เดินเมนูไม่ยิงซ้ำ */
const TTL_MS = 60_000;

let cache: { at: number; counts: ConveyorCounts } | null = null;
let inflight: Promise<ConveyorCounts> | null = null;

async function load(): Promise<ConveyorCounts> {
  /**
   * ยิงสองเส้นพร้อมกันและ **แยกผลกันเด็ดขาด** — เส้น office-floor อ่านแต่ pg (เร็ว)
   * ส่วน flow-summary แตะ ERP · เส้นหนึ่งล้มต้องไม่ลากอีกเส้นตกไปด้วย
   * ไม่งั้น ERP ล่มทีเดียว = ป้ายหายทั้งแถบทั้งที่เลขฝั่ง pg ยังรู้อยู่
   */
  const [flow, office] = await Promise.all([
    fetchFlowSummary().catch(() => null),
    fetchOfficeFloor().catch(() => null),
  ]);
  return {
    requests: flow ? flow.jobs.open_total : null,
    postings: flow ? flow.postings.active : null,
    /**
     * ขั้น 3 นับ **ของที่ต้องลงมือ ไม่ใช่ยอดสะสม** — `untouched` = ใบสมัครที่ยังไม่มี
     * ใครแตะเลย · เอา `newToday` มาแทนไม่ได้เพราะวันที่ไม่มีคนสมัครจะขึ้น 0 ทั้งที่
     * ยังมีของค้างจากเมื่อวานรออยู่ (เคสจริง: 0.6% conversion ⇒ วันส่วนใหญ่ newToday = 0)
     */
    applicants: office ? office.counts.intake.untouched : null,
    matching: flow ? flow.jobs.with_recommend : null,
    /** เลยเวลานัดแล้วยังไม่มีผล = ของค้างจริง (นัดวันนี้ที่ยังไม่ถึงเวลาไม่ใช่ของค้าง) */
    follow: office ? office.counts.follow.pastDue : null,
    aftercare: office?.counts.aftercare?.enabled ? office.counts.aftercare.count : null,
  };
}

export function useConveyorCounts(): ConveyorCounts {
  const [counts, setCounts] = useState<ConveyorCounts>(() => cache?.counts ?? {});

  useEffect(() => {
    let cancelled = false;
    const fresh = cache && Date.now() - cache.at < TTL_MS;
    if (fresh) {
      setCounts(cache!.counts);
      return;
    }
    // มีคนอื่นกำลังโหลดอยู่ = รอผลก้อนเดียวกัน ไม่ยิงซ้ำ
    inflight ??= load().then((c) => {
      cache = { at: Date.now(), counts: c };
      inflight = null;
      return c;
    });
    void inflight.then((c) => {
      if (!cancelled) setCounts(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}
