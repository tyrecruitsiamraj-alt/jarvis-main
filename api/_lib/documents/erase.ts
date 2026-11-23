/**
 * ล้างข้อมูลงานส่งเอกสารตามคำขอลบข้อมูลส่วนบุคคล (PDPA) — เรียกจาก `erasePdpaPerson` ในธุรกรรมเดียวกัน (22 พ.ย. 2569)
 *
 * ล้าง: ภาพทุกใบ (ไบต์) · ข้อมูลในชุดที่ส่ง · บัญชี LINE ที่เปิดลิงก์ · ชื่อในแจ้งเตือน · คุกกี้ของผู้สมัคร · ลิงก์ที่ยังใช้ได้ถูกยกเลิก
 * เหลือ: แถวลิงก์/ชุด/เหตุการณ์ (ไม่มีข้อมูลบุคคล) ไว้นับสถิติ — ชุดที่ส่งแล้วแก้ได้ครั้งเดียวตอนล้าง (trigger อนุญาตเฉพาะตอน erased_at เปลี่ยนจากว่าง)
 * ตารางยังไม่มี (ยังไม่ได้รัน migration 195) = ข้าม · error อื่นโยนต่อ (ห้ามบอกว่าลบแล้วทั้งที่ยังไม่ได้ลบ)
 */
import type { PoolClient } from 'pg';
import { isPgUndefinedTable } from '../postgres.js';
import { T } from './core.js';

const ERASED_TITLE = 'มีผู้สมัครส่งเอกสารแล้ว';

export async function eraseDocumentsForApplications(
  client: PoolClient,
  applicationIds: string[],
  erasedName: string,
): Promise<{ documentPackets: number; documentFiles: number }> {
  if (!applicationIds.length) return { documentPackets: 0, documentFiles: 0 };
  await client.query('savepoint documents_erase');
  try {
    const ids = [applicationIds];
    const { rows: files } = await client.query<{ id: string }>(`select id from ${T.files} where application_id = any($1::uuid[])`, ids);
    if (files.length) await client.query(`delete from ${T.blobs} where file_id = any($1::uuid[])`, [files.map((f) => f.id)]);
    await client.query(
      `update ${T.files} set state = 'erased', line_user_id = '', discarded_at = coalesce(discarded_at, now()) where application_id = any($1::uuid[])`,
      ids,
    );
    const { rows: packets } = await client.query<{ id: string }>(
      `update ${T.packets}
          set erased_at = now(), person_name = $2, payload_enc = '', line_user_id = '', line_display_name = '', line_picture_url = null, national_id_hash = null,
              client_ip = null, user_agent = null, review_note = null, attention_ack_note = null
        where application_id = any($1::uuid[]) and erased_at is null
        returning id`,
      [applicationIds, erasedName],
    );
    await client.query(
      `delete from ${T.sessions} where invitation_id in (select id from ${T.invitations} where application_id = any($1::uuid[]))`,
      ids,
    );
    await client.query(
      `update ${T.invitations}
          set applicant_name = $2, claimed_line_user_id = null, line_display_name = null, line_picture_url = null,
              revoked_at = coalesce(revoked_at, now()), revoked_by_name = coalesce(revoked_by_name, 'ลบข้อมูลตามคำขอ')
        where application_id = any($1::uuid[])`,
      [applicationIds, erasedName],
    );
    await client.query(
      `update ${T.events} set actor_id = null, actor_name = null where application_id = any($1::uuid[]) and actor_type = 'applicant'`,
      ids,
    );
    const { rows: all } = await client.query<{ id: string }>(`select id from ${T.packets} where application_id = any($1::uuid[])`, ids);
    if (all.length) {
      const packetIds = all.map((p) => p.id);
      await client.query(`update ${T.outbox} set title = $2 where packet_id = any($1::uuid[])`, [packetIds, ERASED_TITLE]);
      await client.query(`update ${T.notifications} set title = $2 where dedupe_key = any($1::text[])`, [
        packetIds.map((id) => `document_packet_submitted:${id}`),
        ERASED_TITLE,
      ]);
    }
    await client.query('release savepoint documents_erase');
    return { documentPackets: packets.length, documentFiles: files.length };
  } catch (e) {
    await client.query('rollback to savepoint documents_erase');
    if (isPgUndefinedTable(e)) return { documentPackets: 0, documentFiles: 0 };
    throw e;
  }
}
