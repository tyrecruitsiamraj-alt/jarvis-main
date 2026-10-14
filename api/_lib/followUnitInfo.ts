/**
 * ═══ ข้อมูลประกัน + ผู้ติดต่อลูกค้า ของหน่วยงาน — ขั้น 4 ของฟอร์มเพิ่มคนติดตาม (เจ้าของสั่ง 14 ต.ค. 2569) ═══
 * > *"ประเภทประกัน (อยากให้ดึงเชื่อมกับข้อ 2.หน่วยงาน เพราะเงื่อนไขมีประเภทประกันอยู่) และ ดึง ชื่อ-เบอร์โทร ลูกค้า มาให้ด้วย"*
 * Choice "เก็บติดรายการ แก้ได้"
 *
 * ERP (อ่านอย่างเดียว): ใบขอล่าสุดของไซต์ (`st_request_head.site_code`) →
 *   ประกัน `st_request_p2_grantee` × `st_ms_grantee_type` (ชื่อ + หมายเหตุ เช่น "P/A · งบประมาณ 300.00 บาท/คน/ปี") ·
 *   ผู้ติดต่อ `st_request_p1` (customer_name · contact_name · contact_position · mobile/phone)
 * ⚠️ SQL Server ของ ERP ไม่มี string_agg — รวมแถวใน JS · ล้ม/ไม่เจอ = คืนค่าว่าง (ฟอร์มกรอกเองได้)
 */
import { siamrajSqlQuery } from './siamrajSqlServer.js';

export type FollowUnitInfo = {
  requestNo: string | null;
  insurance: string[];
  customerName: string | null;
  contactName: string | null;
  contactPosition: string | null;
  contactPhone: string | null;
};

const EMPTY: FollowUnitInfo = {
  requestNo: null,
  insurance: [],
  customerName: null,
  contactName: null,
  contactPosition: null,
  contactPhone: null,
};

const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return s && s !== '-' ? s : null;
};

export async function loadFollowUnitInfo(input: { siteCode?: string | null; requestNo?: string | null }): Promise<FollowUnitInfo> {
  const site = clean(input.siteCode);
  // ใบขอจากบอร์ดก่อน (ใบที่ตามเรื่องอยู่จริง) · ไม่เจอใน ERP (เช่นใบขอล่วงหน้า) = ใบล่าสุดของไซต์
  const fromRequest = clean(input.requestNo) ? await loadByRequest(clean(input.requestNo)) : { ...EMPTY };
  if (fromRequest.insurance.length > 0 || fromRequest.customerName || !site) return fromRequest;
  return loadByRequest(null, site);
}

async function loadByRequest(req: string | null, site: string | null = null): Promise<FollowUnitInfo> {
  let requestNo = req;
  if (!requestNo && site) {
    const rows = await siamrajSqlQuery<{ request_no: string }>(
      `select top 1 h.request_no from st_request_head h
        where h.site_code = @site and h.cancel_date is null
        order by h.request_date desc, h.request_no desc`,
      { site },
    );
    requestNo = clean(rows[0]?.request_no);
  }
  if (!requestNo) return { ...EMPTY };

  const [grantee, contact] = await Promise.all([
    siamrajSqlQuery<{ name: string | null; remark: string | null }>(
      `select t.grantee_type_name as name, g.remark from st_request_p2_grantee g
         join st_ms_grantee_type t on t.grantee_type_code = g.grantee_type_code
        where g.request_no = @req order by g.seq`,
      { req: requestNo },
    ),
    siamrajSqlQuery<{
      customer_name: string | null;
      contact_name: string | null;
      contact_position: string | null;
      mobile: string | null;
      phone: string | null;
    }>(`select top 1 customer_name, contact_name, contact_position, mobile, phone from st_request_p1 where request_no = @req`, {
      req: requestNo,
    }),
  ]);
  const insurance = grantee
    .map((g) => [clean(g.name), clean(g.remark)].filter(Boolean).join(' · '))
    .filter((s) => s.length > 0);
  const c = contact[0];
  return {
    requestNo,
    insurance: [...new Set(insurance)],
    customerName: clean(c?.customer_name),
    contactName: clean(c?.contact_name),
    contactPosition: clean(c?.contact_position),
    contactPhone: clean(c?.mobile) ?? clean(c?.phone),
  };
}
