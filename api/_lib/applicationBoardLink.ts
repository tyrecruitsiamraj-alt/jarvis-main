/**
 * เส้นแบ่งสรรหา → คัดสรร (เจ้าของเคาะ 16 ส.ค. 2569)
 *
 * "ใบสมัครเรียบร้อย" = ชื่อคนขึ้นถังบนบอร์ด ERP แล้ว (สรรหาคีย์เข้าระบบเดิม) —
 * ไม่มีปุ่ม ไม่ stamp · derived ตอนอ่าน: ใบสนใจที่ **เบอร์ตรงกับคนบนบอร์ด** = ได้ใบสมัครแล้ว
 * (ออกจากคิวสรรหา ไปเป็นงานของคัดสรร)
 *
 * ⚠️ จับคู่ด้วย **เบอร์ E.164** (ฝั่งเราไม่มี citizen_id ของใบสนใจ) — เป็น proxy
 * ต้องติดธง "จับคู่ด้วยเบอร์" บนจอ · เบอร์บอร์ดมีขีดปน → normalize ด้วย toE164Thai
 * (สูตรเดียวกับ phone_e164 ของใบสมัคร — เทียบ set แล้วตรงกันเป๊ะ)
 *
 * ⚠️ ERP อ่านไม่ได้ → คืน **null** ไม่ใช่ set ว่าง — "เช็คไม่ได้" ≠ "ไม่มีใครบนบอร์ด"
 * ผู้เรียกต้องแยกสองเคสนี้ (null = ขีด+ธง unavailable · set ว่าง = ยังไม่มีใครขึ้นบอร์ด)
 */
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { toE164Thai } from './thaiPhone.js';

/** ทุกถังบนบอร์ด — "ขึ้นบอร์ดแล้ว" คือมีชื่ออยู่ถังไหนก็ได้ (รวม To do/Done/ฯลฯ) */
const BOARD_ID = Number(process.env.BOARD_READY_BOARD_ID || 1);

let cache: { at: number; phones: Set<string> } | null = null;
const CACHE_MS = 60_000; // บอร์ด ~2000 คน · cache 1 นาทีพอ (handoff ไม่ต้องสด ๆ วินาที)

/**
 * Set ของเบอร์ E.164 ที่มีชื่ออยู่บนบอร์ด (คนสมัครแล้ว) · null = ERP อ่านไม่ได้
 * `force` ข้าม cache (เทสต์/ตรวจ)
 */
export async function loadBoardPhoneSet(force = false): Promise<Set<string> | null> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.phones;
  try {
    const rows = await siamrajSqlQuery<{ mobile: string | null; phone: string | null }>(
      `SELECT RTRIM(r.mobile) AS mobile, RTRIM(r.phone) AS phone
         FROM dbo.ir_board_card c
         INNER JOIN dbo.hr_recruitment r ON r.citizen_id = c.citizen_id
        WHERE c.board_id = @boardId AND c.is_archived = 'N'`,
      { boardId: BOARD_ID },
    );
    const phones = new Set<string>();
    for (const r of rows) {
      const m = toE164Thai(r.mobile);
      if (m) phones.add(m);
      const p = toE164Thai(r.phone);
      if (p) phones.add(p);
    }
    cache = { at: Date.now(), phones };
    return phones;
  } catch {
    // ERP ล่ม/ช้า — ไม่ throw (handoff เป็นข้อมูลเสริม) แต่คืน null ให้ผู้เรียกติดธง
    return null;
  }
}
