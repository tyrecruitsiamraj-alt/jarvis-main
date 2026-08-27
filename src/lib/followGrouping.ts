import type { FollowEntry } from '@/lib/followApi';
import { phoneKey } from '@/lib/followDuplicateGuard';

/**
 * **จัดกลุ่มลิสต์หน้า Follow เป็นการ์ดเดียวต่อคน** (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ:
 * คนเดียวหลายรอบแตกหลายแถว *"งงตาย"* — ต้องการการ์ดเดียวสรุปว่า โทรวันไหนกี่โมง ·
 * หน่วยงานไหน · ใครคีย์ · ติดตามวันไหนบ้าง · วันนี้เป็นครั้งที่เท่าไหร่)
 *
 * กลุ่ม = **เบอร์ (เลข 9 ตัวท้าย) + เรื่อง** — แพตเทิร์นเดียวกับ `siblings` ของกล่องแก้ไข
 * เบอร์อย่างเดียวไม่พอ: คนเดียวถูกตามหลายเรื่องพร้อมกันได้ ต้องแยกการ์ดกัน
 *
 * ⚠️ "เริ่มงานวันไหน" **ไม่มีฟิลด์เก็บ** — อยู่ในข้อความ topic/note ที่คนพิมพ์เอง
 * จึงตั้งใจไม่โชว์บรรทัดนั้น (จะโชว์จริงต้องเพิ่มฟิลด์ในฟอร์ม — รอเจ้าของเคาะ)
 */

export type FollowGroup = {
  /** เบอร์(9 ตัวท้าย)|เรื่อง — ใช้เป็น React key ได้ */
  key: string;
  /** ชื่อจากรอบล่าสุด — สะกดล่าสุดชนะ (คนแก้ชื่อแล้วการ์ดต้องตามทัน) */
  name: string;
  phone: string;
  topic: string;
  /** หน่วยงาน/รหัสไซต์จากรอบล่าสุดที่ระบุไว้ — null = ไม่มีรอบไหนระบุเลย */
  unitName: string | null;
  siteCode: string | null;
  /** เจ้าของข้อมูล = คนที่คีย์รอบแรกสุดของกลุ่ม */
  createdByName: string | null;
  /** ทุกรอบ (รวมยกเลิก/ปิดแล้ว) เรียงตามเวลานัดโทร — ไม่มีเวลาไปท้ายสุด */
  rounds: FollowEntry[];
  /** จำนวนรอบที่ไม่ถูกยกเลิก */
  activeCount: number;
  /** รอบถัดไปที่ยังรอโทรและเวลายังไม่ผ่าน — null = ไม่มีนัดข้างหน้าแล้ว */
  nextRound: FollowEntry | null;
  /**
   * รอบที่ **เลยเวลานัดแล้วแต่ยังไม่มีผล** (เก่าสุดก่อน) — null = ไม่มีของค้าง
   *
   * 🔴 ทำไมต้องแยกช่องนี้ (audit มุมพนักงานใหม่ 26 ส.ค. 2569): เดิมการ์ดมีแค่
   * `nextRound` ⇒ รอบที่เลยเวลาแล้วตกไปทั้งสองทาง จอจึงขึ้น
   * **"ไม่มีนัดโทรข้างหน้าแล้ว" คู่กับป้าย "รอ AI โทร" บนใบเดียวกัน**
   * ซึ่งอ่านแล้วขัดกันเอง · ของค้างต้องมีที่ยืนของตัวเอง ห้ามตกไปเงียบ ๆ
   */
  overdueRound: FollowEntry | null;
  /**
   * วันนี้เป็นการติดตามครั้งที่เท่าไหร่ — ลำดับ (1-based) ของรอบแรกของวันนี้
   * ในบรรดารอบที่ไม่ถูกยกเลิก · null = วันนี้ไม่มีรอบ
   */
  todayOrdinal: number | null;
  /** เวลาสร้างล่าสุดในกลุ่ม — ใช้เรียงกลุ่ม (ใหม่สุดขึ้นก่อน เหมือนลิสต์เดิม) */
  latestCreatedAt: string | null;
};

const time = (iso: string | null | undefined): number => {
  if (!iso) return Number.NaN;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.NaN : t;
};

/** วันตามเวลาไทย — เทียบ "วันนี้" ต้องเทียบวันที่คนเห็น ไม่ใช่วัน UTC */
const bangkokDay = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

export function groupFollowEntries(entries: FollowEntry[], now = new Date()): FollowGroup[] {
  const buckets = new Map<string, FollowEntry[]>();
  for (const e of entries) {
    // เบอร์อ่านไม่ออก (สั้นกว่า 9 หลัก) ถอยไปใช้เบอร์ดิบ — ยังจัดกลุ่มของตัวเองได้
    const key = `${phoneKey(e.recipient_phone) ?? e.recipient_phone}|${(e.topic || '').trim()}`;
    const list = buckets.get(key);
    if (list) list.push(e);
    else buckets.set(key, [e]);
  }

  const todayKey = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const groups: FollowGroup[] = [];

  for (const [key, list] of buckets) {
    // เรียงตามเวลานัดโทร — ไม่มีเวลา/เวลาพังไปท้ายสุด (เสถียร: เสมอกันใช้ created_at)
    const rounds = [...list].sort((a, b) => {
      const ta = time(a.scheduled_at);
      const tb = time(b.scheduled_at);
      if (Number.isNaN(ta) && Number.isNaN(tb)) return time(a.created_at) - time(b.created_at);
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return ta - tb || time(a.created_at) - time(b.created_at);
    });

    const active = rounds.filter((r) => !r.cancelled);
    const byCreated = [...list].sort((a, b) => time(a.created_at) - time(b.created_at));
    const first = byCreated[0];
    const latest = byCreated[byCreated.length - 1];

    // หน่วยงานจากรอบล่าสุดที่ระบุไว้ — รอบเก่าอาจยังไม่ทันกรอก
    const withUnit = [...byCreated].reverse().find((r) => r.unit_name || r.site_code);

    const nextRound =
      active.find(
        (r) =>
          r.call_status === 'pending' &&
          !r.completed_at &&
          !Number.isNaN(time(r.scheduled_at)) &&
          time(r.scheduled_at) >= now.getTime(),
      ) ?? null;

    /** เลยเวลานัดแล้วยังไม่มีผล — นิยามเดียวกับ `followScheduleCounts` (ยกเลิกไม่นับอยู่แล้ว) */
    const overdueRound =
      active.find(
        (r) =>
          !r.call_outcome &&
          !r.completed_at &&
          !Number.isNaN(time(r.scheduled_at)) &&
          time(r.scheduled_at) < now.getTime(),
      ) ?? null;

    const todayIdx = active.findIndex((r) => bangkokDay(r.scheduled_at) === todayKey);

    groups.push({
      key,
      name: latest.recipient_name,
      phone: latest.recipient_phone,
      topic: latest.topic,
      unitName: withUnit?.unit_name ?? null,
      siteCode: withUnit?.site_code ?? null,
      createdByName: first.created_by_name ?? null,
      rounds,
      activeCount: active.length,
      nextRound,
      overdueRound,
      todayOrdinal: todayIdx === -1 ? null : todayIdx + 1,
      latestCreatedAt: latest.created_at ?? null,
    });
  }

  // กลุ่มที่ลงล่าสุดขึ้นก่อน — ความรู้สึกเดียวกับลิสต์เดิม (server เรียง created_at desc)
  groups.sort((a, b) => time(b.latestCreatedAt) - time(a.latestCreatedAt));
  return groups;
}
