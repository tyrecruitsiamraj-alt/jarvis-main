/**
 * iRecruit ดึงเอกสารที่ผู้สมัครส่งผ่าน LINE ด้วยเลขบัตรประชาชน (เจ้าของ 23 พ.ย. 2569
 * "irecruit จะเรียกโหลดรูปอะเพื่อไปที่ irecruit" · "เฉพาะคนที่บัตรประชาชนตรงกับ irecruit")
 * ฐานทดสอบในเครื่อง · ข้อมูลจำลองทั้งหมด
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { HAS_DB, fullSubmission, packetsHandler, world, type World } from './fixtures';
import { call } from './harness';
import { dbQuery, dbTransaction } from '../../../api/_lib/postgres';
import { T } from '../../../api/_lib/documents/core';
import { eraseDocumentsForApplications } from '../../../api/_lib/documents/erase';
import { clearIntegrationKeyCache, sha256Hex } from '../../../api/_lib/integrationKeyAuth';
import irecruitDocumentsHandler from '../../../api/_handlers/irecruit-documents';

const KEY = 'jv_irecruit_test_key_for_local_db_only_0123456789';
const KEYS = 'jarvis_rm.app_integration_keys';
const d = HAS_DB ? describe : describe.skip;

d('iRecruit ดึงเอกสารด้วยเลขบัตร', () => {
  let w: World;
  let packetId = '';
  let nationalId = '';

  beforeAll(async () => {
    w = await world();
    await dbQuery(`delete from ${KEYS} where name = 'irecruit'`);
    await dbQuery(`insert into ${KEYS} (name, key_sha256) values ('irecruit', $1)`, [sha256Hex(KEY)]);
    clearIntegrationKeyCache('irecruit');
    const s = await fullSubmission(w.staffLbd, w.appLbd);
    packetId = s.packetId;
    nationalId = String(s.body.person.nationalId);
  });

  const get = (query: Record<string, unknown>, key: string | null = KEY) =>
    call(irecruitDocumentsHandler, { query, origin: null, headers: key ? { 'x-api-key': key } : {} });

  it('ไม่มีกุญแจ / กุญแจผิด = 401 ไม่อ่านข้อมูล', async () => {
    expect((await get({ national_id: nationalId }, null)).status).toBe(401);
    expect((await get({ national_id: nationalId }, 'jv_irecruit_wrong')).status).toBe(401);
  });

  it('เลขบัตรตรง = ได้ชุดล่าสุด ข้อมูล ที่อยู่ คำตอบ 5 ฉบับ รูป 3 ใบ PDF 5 ฉบับ · ชุดเก็บแฮชเลขบัตรไว้ค้น (ไม่ใช่เลขบัตร)', async () => {
    const r = await get({ national_id: nationalId });
    expect(r.status).toBe(200);
    expect(r.json.found).toBe(true);
    expect(r.json.packet_id).toBe(packetId);
    expect(r.json.person.nationalId).toBe(nationalId);
    expect(r.json.consents).toHaveLength(5);
    expect(r.json.files.map((f: { kind: string }) => f.kind).sort()).toEqual(['house', 'id', 'license']);
    expect(r.json.pdfs).toHaveLength(5);
    expect(r.json.imported).toBeNull();
    expect(r.headers['cache-control']).toBe('no-store');
    const { rows } = await dbQuery<{ national_id_hash: string | null }>(`select national_id_hash from ${T.packets} where id = $1`, [packetId]);
    expect(rows[0].national_id_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].national_id_hash).not.toContain(nationalId);
  });

  it('เลขบัตรที่ไม่มีชุด = 404 found:false · เลขผิดรูป = 400', async () => {
    const miss = await get({ national_id: '1111111111119' });
    expect(miss.status).toBe(404);
    expect(miss.json.found).toBe(false);
    expect((await get({ national_id: '12345' })).status).toBe(400);
  });

  it('โหลดรูปได้เฉพาะคู่กับเลขบัตรเจ้าของ · เลขบัตรอื่น = 404', async () => {
    const view = await get({ national_id: nationalId });
    const fileId = view.json.files[0].file_id;
    const ok = await get({ national_id: nationalId, file: fileId });
    expect(ok.status).toBe(200);
    expect(String(ok.headers['content-type'])).toMatch(/^image\//);
    expect(ok.bytes?.length).toBeGreaterThan(100);
    expect((await get({ national_id: '1111111111119', file: fileId })).status).toBe(404);
  });

  it('PDF ของเอกสารในชุดนั้นโหลดได้ · ชุดอื่น = 404', async () => {
    const ok = await get({ national_id: nationalId, pdf: 'background', packet_id: packetId });
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toBe('application/pdf');
    expect(ok.bytes?.subarray(0, 4).toString()).toBe('%PDF');
    expect((await get({ national_id: nationalId, pdf: 'background', packet_id: '00000000-0000-4000-8000-000000000000' })).status).toBe(404);
  });

  it('iRecruit แจ้งเลขที่กลับ = ชุดขึ้นนำเข้าแล้วในแท็บเอกสาร · ส่งซ้ำเลขเดิมได้ · เลขอื่น = 409', async () => {
    const post = (no: string) =>
      call(irecruitDocumentsHandler, { method: 'POST', origin: null, headers: { 'x-api-key': KEY }, body: { national_id: nationalId, packet_id: packetId, irecruit_applicant_no: no, department: 'SN' } });
    const first = await post('A123456');
    expect(first.status).toBe(200);
    expect(first.json).toEqual({ packet_id: packetId, irecruit_applicant_no: 'A123456', already: false });
    expect((await post('A123456')).json.already).toBe(true);
    expect((await post('B999')).status).toBe(409);
    const detail = await call(packetsHandler, { cookie: w.staffLbd.cookie, query: { applicationId: w.appLbd } });
    expect(detail.json.status).toBe('imported');
    expect((await get({ national_id: nationalId })).json.imported).toMatchObject({ irecruit_applicant_no: 'A123456', by: 'iRecruit' });
  });

  it('ล้างข้อมูลตาม PDPA แล้ว iRecruit หาไม่เจอ · แฮชเลขบัตรถูกล้าง', async () => {
    await dbTransaction((client) => eraseDocumentsForApplications(client, [w.appLbd], 'ลบข้อมูลแล้ว'));
    expect((await get({ national_id: nationalId })).status).toBe(404);
    const { rows } = await dbQuery<{ national_id_hash: string | null }>(`select national_id_hash from ${T.packets} where id = $1`, [packetId]);
    expect(rows[0].national_id_hash).toBeNull();
  });
});
