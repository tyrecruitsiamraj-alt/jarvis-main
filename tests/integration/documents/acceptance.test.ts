/**
 * ตรวจรับ "ส่งเอกสารผ่าน LINE" กับฐานข้อมูลจริง (Postgres ทิ้งได้ในเครื่อง · ข้อมูลจำลองทั้งหมด)
 * รหัส DOC-xxx = ข้อในรายการตรวจรับ 64 ข้อ (acceptance-cases.json ของชุดส่งต่อ 22 พ.ย. 2569)
 * ข้อที่ต้องดูบนจอ/มือถือจริงไม่อยู่ที่นี่ — ดูสรุปผลใน docs/applicant-documents.md
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HAS_DB,
  addApplication,
  addUser,
  count,
  createLink,
  enableFeature,
  fullSubmission,
  invitationsHandler,
  notificationsHandler,
  openLink,
  packetBody,
  packetsHandler,
  publicHandler,
  resetAll,
  settingsHandler,
  submit,
  uploadAll,
  uploadKind,
  uploadTemplates,
  world,
  type World,
} from './fixtures';
import { call, cookieOf, dataUrl, documentImage, mockLineToken, png, signaturePng, type Json } from './harness';
import { dbQuery } from '../../../api/_lib/postgres';
import { T, clearDocumentSettingsCache } from '../../../api/_lib/documents/core';
import { dispatchDueOutbox, documentWatchUntil } from '../../../api/_lib/documents/outbox';
import { setIrecruitExportAdapter } from '../../../api/_lib/documents/staff';
import { eraseDocumentsForApplications } from '../../../api/_lib/documents/erase';
import { dbTransaction } from '../../../api/_lib/postgres';
import { DOCUMENT_STATUS_LABEL } from '../../../src/lib/documents/documentStatus';
import { parseDocumentsDeepLink } from '../../../src/lib/documents/documentNotification';
import { PDFDocument } from 'pdf-lib';

const d = describe.skipIf(!HAS_DB);
let w: World;

/** รอให้การแจ้งเตือนที่ยิงตามหลังการส่ง (ไม่รอผล) ทำเสร็จ */
const settle = async () => {
  await new Promise((r) => setTimeout(r, 30));
  await dispatchDueOutbox();
};
const detail = (user: { cookie: string }, applicationId: string, packetId?: string) =>
  call(packetsHandler, { cookie: user.cookie, query: packetId ? { applicationId, packetId } : { applicationId } });
const list = (user: { cookie: string }, query: Record<string, unknown> = {}) => call(packetsHandler, { cookie: user.cookie, query });
const inbox = (user: { cookie: string }) => call(notificationsHandler, { cookie: user.cookie });

d('ลิงก์และ LINE', () => {
  beforeEach(async () => {
    w = await world();
  });

  it('DOC-001 กดส่งเอกสาร ได้ลิงก์เฉพาะใบสมัคร + ใบขอ และไม่มีการส่งข้อความ LINE', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ห้ามเรียกออกนอกระบบ'));
    const a = await createLink(w.staffLbd, w.appLbd);
    const b = await createLink(w.staffLbd, w.appLbd);
    expect(a.invite).toMatch(/^[a-f0-9]{64}$/);
    expect(a.invite).not.toBe(b.invite);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    const { rows } = await dbQuery<{ application_id: string; job_label: string; department_code: string; token_hash: string; revision: number }>(
      `select application_id, job_label, department_code, token_hash, revision from ${T.invitations} order by revision`,
    );
    expect(rows.map((r) => r.revision)).toEqual([1, 2]);
    expect(rows[0]).toMatchObject({ application_id: w.appLbd, department_code: 'LBD' });
    expect(rows[0].job_label).toContain('พนักงานขับรถ');
    // ฐานเก็บแฮช ไม่เก็บรหัสลิงก์
    expect(rows[0].token_hash).not.toBe(a.invite);
    expect(await count(`select count(*) as n from ${T.invitations} where token_hash = $1`, [a.invite])).toBe(0);
    // อายุ 24 ชั่วโมง
    const hours = (Date.parse(a.reply.json.expiresAt) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThanOrEqual(24);
  });

  it('DOC-003 ผู้ไม่มีสิทธิ์สร้างลิงก์ไม่ได้ แม้ยิง API ตรง', async () => {
    const anon = await call(invitationsHandler, { method: 'POST', body: { applicationId: w.appLbd } });
    expect(anon.status).toBe(401);
    const readOnly = await call(invitationsHandler, { method: 'POST', cookie: w.oplLbd.cookie, body: { applicationId: w.appLbd } });
    expect(readOnly.status).toBe(403);
    const otherBu = await call(invitationsHandler, { method: 'POST', cookie: w.staffLba.cookie, body: { applicationId: w.appLbd } });
    expect(otherBu.status).toBe(403);
    expect(await count(`select count(*) as n from ${T.invitations}`)).toBe(0);
  });

  it('DOC-004 ข้าม BU: รายการ รายละเอียด ภาพ PDF ต้นฉบับ ถูกปฏิเสธ', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd);
    const own = await list(w.staffLbd);
    expect(own.json.items.map((i: Json) => i.applicationId)).toEqual([w.appLbd]);
    const other = await list(w.staffLba);
    expect(other.json.items).toEqual([]);
    expect((await detail(w.staffLba, w.appLbd)).status).toBe(403);
    expect((await detail(w.staffLba, w.appLbd, s.packetId)).status).toBe(403);
    expect((await call(packetsHandler, { cookie: w.staffLba.cookie, query: { file: s.files[0].id } })).status).toBe(403);
    expect((await call(packetsHandler, { cookie: w.staffLba.cookie, query: { pdf: 'ex', packetId: s.packetId } })).status).toBe(403);
    expect((await call(packetsHandler, { cookie: w.staffLba.cookie, query: { template: 'ex', page: 1, packetId: s.packetId } })).status).toBe(403);
    expect((await call(invitationsHandler, { cookie: w.staffLba.cookie, query: { applicationId: w.appLbd } })).status).toBe(403);
    // ไม่ได้ล็อกอิน = 401 ทุกเส้นของเจ้าหน้าที่
    expect((await call(packetsHandler, { query: { file: s.files[0].id } })).status).toBe(401);
  });

  it('DOC-005 ผู้สมัครถึงฟอร์มได้โดยไม่มีบัญชีเจ้าหน้าที่', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const config = await call(publicHandler, { query: { action: 'config' } });
    expect(config.json).toMatchObject({ enabled: true });
    const o = await openLink(link.invite);
    expect(o.reply.status).toBe(200);
    expect(o.state.applicant).toMatchObject({ name: 'สมมติ ทดลองระบบ', bu: 'LBD' });
    expect(o.state.documents.map((x: Json) => x.id)).toEqual(['background', 'payroll', 'privacy', 'ex', 'reputation']);
    const state = await call(publicHandler, { cookie: o.cookie, query: { action: 'state', k: o.k } });
    expect(state.status).toBe(200);
  });

  it('DOC-008/009/010 เปิดลิงก์แล้วยังไม่แนบ: HR เห็นชื่อ LINE เวลาเปิด และยังไม่ส่ง · ผูกด้วยรหัส ไม่จับคู่ชื่อ · ไม่มีรูปก็ไม่ใส่รูปแทน', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite, 'ชื่อไลน์ไม่ตรงบัตร 🐱');
    expect(o.reply.status).toBe(200);
    const r = await detail(w.staffLbd, w.appLbd);
    expect(r.json.status).toBe('opened');
    expect(DOCUMENT_STATUS_LABEL[r.json.status as 'opened']).toBe('เปิดลิงก์แล้ว ยังไม่ส่งเอกสาร');
    const inv = r.json.invitations[0];
    expect(inv.line).toMatchObject({ userId: o.sub, displayName: 'ชื่อไลน์ไม่ตรงบัตร 🐱', pictureUrl: null, openCount: 1 });
    expect(inv.line.firstOpenedAt).toBeTruthy();
    expect(r.json.packet).toBeNull();
    expect(r.json.application.name).toBe('สมมติ ทดลองระบบ');
    const row = (await list(w.staffLbd)).json.items[0];
    expect(row).toMatchObject({ status: 'opened', packetId: null, submittedAt: null });
    expect(row.line.displayName).toBe('ชื่อไลน์ไม่ตรงบัตร 🐱');
  });

  it('DOC-010 รูปโปรไฟล์รับเฉพาะ https ของ LINE', async () => {
    const a = await createLink(w.staffLbd, w.appLbd);
    await openLink(a.invite, 'มีรูป', { picture: 'https://profile.line-scdn.net/0hAbCdEf' });
    const b = await createLink(w.staffLba, w.appLba);
    await openLink(b.invite, 'รูปแปลก', { picture: 'https://evil.example/x.png' });
    expect((await detail(w.staffLbd, w.appLbd)).json.invitations[0].line.pictureUrl).toBe('https://profile.line-scdn.net/0hAbCdEf');
    expect((await detail(w.staffLba, w.appLba)).json.invitations[0].line.pictureUrl).toBeNull();
  });

  it('DOC-011 เปิดซ้ำด้วยบัญชีเดิม: เวลาเปิดครั้งแรกคงเดิม ครั้งล่าสุดเปลี่ยน ไม่สร้างใบสมัครซ้ำ', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const first = await openLink(link.invite, 'Ty');
    const before = (await detail(w.staffLbd, w.appLbd)).json.invitations[0].line;
    await new Promise((r) => setTimeout(r, 25));
    const again = await openLink(link.invite, 'Ty เปลี่ยนชื่อ', { sub: first.sub });
    expect(again.reply.status).toBe(200);
    const after = (await detail(w.staffLbd, w.appLbd)).json.invitations[0].line;
    expect(after.firstOpenedAt).toBe(before.firstOpenedAt);
    expect(Date.parse(after.lastOpenedAt)).toBeGreaterThan(Date.parse(before.lastOpenedAt));
    expect(after.openCount).toBe(2);
    expect(await count(`select count(*) as n from ${T.applications}`)).toBe(2);
    expect(await count(`select count(*) as n from ${T.events} where event_type in ('opened', 'reopened')`)).toBe(2);
  });

  it('DOC-012 สองบัญชีเปิดลิงก์เดียวพร้อมกัน: ผูกได้บัญชีเดียว ไม่เขียนทับกัน', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const [a, b] = await Promise.all([openLink(link.invite, 'บัญชี A'), openLink(link.invite, 'บัญชี B')]);
    const statuses = [a.reply.status, b.reply.status].sort();
    expect(statuses).toEqual([200, 409]);
    const winner = a.reply.status === 200 ? a : b;
    const loser = a.reply.status === 200 ? b : a;
    expect(loser.reply.json.error).toBe('account_conflict');
    const { rows } = await dbQuery<{ claimed_line_user_id: string }>(`select claimed_line_user_id from ${T.invitations}`);
    expect(rows[0].claimed_line_user_id).toBe(winner.sub);
    // บัญชีที่แพ้เปิดซ้ำกี่ครั้งก็ไม่ได้ และ HR เห็นว่ามีบัญชีอื่นพยายามเปิด
    expect((await openLink(link.invite, 'บัญชี B', { sub: loser.sub })).reply.status).toBe(409);
    expect(await count(`select count(*) as n from ${T.events} where event_type = 'account_conflict'`)).toBe(2);
  });

  it('DOC-013 ลิงก์ปลอม / หมดอายุ / ถูกยกเลิก เปิดไม่ได้ และไม่มีไฟล์ให้ดู', async () => {
    const fake = await openLink('a'.repeat(64));
    expect(fake.reply.status).toBe(404);
    expect((await openLink('ไม่ใช่รหัส')).reply.status).toBe(404);

    const expired = await createLink(w.staffLbd, w.appLbd);
    const live = await openLink(expired.invite);
    await uploadAll(live);
    await dbQuery(`update ${T.invitations} set expires_at = now() - interval '1 minute' where id = $1`, [expired.invitationId]);
    expect((await openLink(expired.invite, 'Ty', { sub: live.sub })).reply.json.error).toBe('invite_expired');
    // คุกกี้เดิมก็ใช้ต่อไม่ได้
    expect((await call(publicHandler, { cookie: live.cookie, query: { action: 'state', k: live.k } })).status).toBe(410);

    const revoked = await createLink(w.staffLba, w.appLba);
    const o = await openLink(revoked.invite);
    const files = await uploadAll(o, 50);
    const rv = await call(invitationsHandler, { method: 'POST', cookie: w.staffLba.cookie, body: { action: 'revoke', invitationId: revoked.invitationId } });
    expect(rv.status).toBe(200);
    expect((await openLink(revoked.invite, 'Ty', { sub: o.sub })).reply.json.error).toBe('invite_revoked');
    expect((await call(publicHandler, { cookie: o.cookie, query: { action: 'file', k: o.k, id: files[0].id } })).status).not.toBe(200);
    expect((await submit(o, packetBody(o, files))).status).not.toBe(201);
    expect((await detail(w.staffLba, w.appLba)).json.status).toBe('link_revoked');
  });

  it('DOC-014 เปลี่ยนรหัสไฟล์/ชุด/ใบสมัครในคำขอ ดูของคนอื่นไม่ได้', async () => {
    const mine = await fullSubmission(w.staffLbd, w.appLbd, { seedBase: 100 });
    const otherLink = await createLink(w.staffLba, w.appLba);
    const other = await openLink(otherLink.invite, 'อีกคน');
    const otherFiles = await uploadAll(other, 200);
    // ผู้สมัครอีกคนเปิดไฟล์ของคนแรกด้วยรหัสไฟล์ = ไม่พบ
    const peek = await call(publicHandler, { cookie: other.cookie, query: { action: 'file', k: other.k, id: mine.files[0].id } });
    expect(peek.status).toBe(404);
    // ใช้คีย์ลิงก์ของคนอื่นกับคุกกี้ตัวเอง = ไม่ผ่าน
    expect((await call(publicHandler, { cookie: other.cookie, query: { action: 'state', k: mine.opened.k } })).status).toBe(403);
    // อ้างไฟล์ของคนอื่นในชุดของตัวเอง = ไม่รับ
    const stolen = packetBody(other, [{ id: mine.files[0].id, kind: 'id' }, otherFiles[1], otherFiles[2]]);
    expect((await submit(other, stolen)).json.error).toBe('attachment_mismatch');
    // ไม่มีคุกกี้ = 401
    expect((await call(publicHandler, { query: { action: 'file', id: mine.files[0].id } })).status).toBe(401);
    // เจ้าหน้าที่: รหัสชุดของใบสมัครอื่น = ไม่พบ (ไม่เปิดชุดอื่นแทน)
    expect((await detail(w.admin, w.appLba, mine.packetId)).status).toBe(404);
    // คำสั่งเขียนจากเว็บอื่น (Origin ไม่ตรง) = ไม่รับ
    const csrf = await call(publicHandler, { method: 'POST', origin: 'https://evil.example', cookie: other.cookie, body: packetBody(other, otherFiles) });
    expect(csrf.status).toBe(403);
  });

  it('DOC-015 โทเคน LINE ผิดช่อง/หมดอายุ/ชื่อจาก browser ไม่ถูกเชื่อ', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const noToken = await call(publicHandler, { method: 'POST', body: { action: 'session', invitation: link.invite, idToken: 'x', profile: { displayName: 'ปลอม', userId: 'U' + 'a'.repeat(32) } } });
    expect(noToken.status).toBe(400);
    const expired = `mock.${Buffer.from(JSON.stringify({ sub: 'U' + 'b'.repeat(32), name: 'หมดอายุ', exp: 1 })).toString('base64url')}`;
    expect((await call(publicHandler, { method: 'POST', body: { action: 'session', invitation: link.invite, idToken: expired } })).status).toBe(401);
    const wrongIssuer = `mock.${Buffer.from(JSON.stringify({ sub: 'U' + 'c'.repeat(32), name: 'ผิดผู้ออก', iss: 'https://evil.example' })).toString('base64url')}`;
    expect((await call(publicHandler, { method: 'POST', body: { action: 'session', invitation: link.invite, idToken: wrongIssuer } })).status).toBe(401);
    const badSub = `mock.${Buffer.from(JSON.stringify({ sub: 'someone', name: 'รหัสบัญชีผิดรูป' })).toString('base64url')}`;
    expect((await call(publicHandler, { method: 'POST', body: { action: 'session', invitation: link.invite, idToken: badSub } })).status).toBe(401);
    expect(await count(`select count(*) as n from ${T.invitations} where claimed_line_user_id is not null`)).toBe(0);
    expect(await count(`select count(*) as n from ${T.sessions}`)).toBe(0);
  });

  it('DOC-016 ลิงก์ใหม่ที่ยังไม่มีใครเปิด ไม่เอาบัญชีของลิงก์เก่ามาแสดง', async () => {
    const old = await createLink(w.staffLbd, w.appLbd);
    await openLink(old.invite, 'คนเปิดลิงก์เก่า');
    await createLink(w.staffLbd, w.appLbd);
    const r = await detail(w.staffLbd, w.appLbd);
    expect(r.json.status).toBe('not_opened');
    expect(r.json.invitations[0].line).toBeNull();
    expect(r.json.invitations[1].line.displayName).toBe('คนเปิดลิงก์เก่า');
    expect((await list(w.staffLbd)).json.items[0].line).toBeNull();
  });

  it('DOC-017 ล้าง session ที่หมดอายุแล้ว ประวัติการเปิดลิงก์ยังอยู่', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite, 'Ty');
    await dbQuery(`delete from ${T.sessions}`);
    const r = await detail(w.staffLbd, w.appLbd);
    expect(r.json.invitations[0].line).toMatchObject({ userId: o.sub, displayName: 'Ty' });
    expect(r.json.events.some((e: Json) => e.type === 'opened' && e.actorName === 'Ty')).toBe(true);
    expect((await call(publicHandler, { cookie: o.cookie, query: { action: 'state', k: o.k } })).status).toBe(401);
  });
});

d('เอกสารและภาพ', () => {
  beforeEach(async () => {
    w = await world();
  });

  it('DOC-019 แนบ 3 ประเภท: บัตรหน้า ใบขับขี่หน้า ทะเบียนบ้าน — ไม่มีช่องด้านหลัง', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const files = await uploadAll(o);
    expect(files.map((f) => f.kind)).toEqual(['id', 'license', 'house']);
    for (const kind of ['id_back', 'license_back', 'cv', '']) {
      expect((await uploadKind(o, kind, documentImage(7))).status).toBe(400);
    }
    // ขาด 1 ประเภท = ส่งไม่ได้
    const missing = await submit(o, packetBody(o, files.slice(0, 2)));
    expect(missing.status).toBe(400);
    // ภาพเดียวกันแนบสองประเภท = ไม่รับ
    const sameA = await uploadKind(o, 'id', documentImage(999));
    const sameB = await uploadKind(o, 'license', documentImage(999));
    const dup = await submit(o, packetBody(o, [{ id: sameA.json.id, kind: 'id' }, { id: sameB.json.id, kind: 'license' }, files[2]]));
    expect(dup.json.error).toBe('duplicate_images');
  });

  it('DOC-024 เปลี่ยนเฉพาะรูปใบขับขี่: ฉบับร่างเดิมของใบขับขี่ถูกแทน ภาพอื่นอยู่ครบ', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const files = await uploadAll(o);
    const again = await uploadKind(o, 'license', documentImage(4242));
    expect(again.status).toBe(201);
    const state = await call(publicHandler, { cookie: o.cookie, query: { action: 'state', k: o.k } });
    const drafts = state.json.drafts as { id: string; kind: string }[];
    expect(drafts.find((f) => f.kind === 'license')!.id).toBe(again.json.id);
    expect(drafts.find((f) => f.kind === 'id')!.id).toBe(files[0].id);
    expect(drafts.find((f) => f.kind === 'house')!.id).toBe(files[2].id);
    // ภาพเก่าของใบขับขี่เปิดไม่ได้แล้ว และตัวภาพถูกลบ
    expect((await call(publicHandler, { cookie: o.cookie, query: { action: 'file', k: o.k, id: files[1].id } })).status).toBe(404);
    expect(await count(`select count(*) as n from ${T.blobs} where file_id = $1`, [files[1].id])).toBe(0);
    // ชุดที่อ้างภาพเก่า = ไม่รับ
    expect((await submit(o, packetBody(o, files))).json.error).toBe('attachment_mismatch');
  });

  it('DOC-026 ไฟล์ปลอม SVG / HTML / เกินขนาด ถูกปฏิเสธก่อนเก็บ', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">${'x'.repeat(3000)}</svg>`);
    const html = Buffer.from(`<!doctype html><script>alert(1)</script>${'x'.repeat(3000)}`);
    const pdf = Buffer.from(`%PDF-1.7 ${'x'.repeat(3000)}`);
    for (const bytes of [svg, html, pdf]) {
      const r = await uploadKind(o, 'id', bytes);
      expect(r.status).toBe(415);
    }
    const tiny = await uploadKind(o, 'id', png(50, 40, () => [10, 10, 10, 255]));
    expect(tiny.status).toBe(400);
    const small = await uploadKind(o, 'id', documentImage(1, 320, 200));
    expect(small.status).toBe(400);
    const huge = await call(publicHandler, { method: 'POST', cookie: o.cookie, body: { action: 'upload', k: o.k, kind: 'id', dataBase64: 'A'.repeat(6_000_000) } });
    expect(huge.status).toBe(413);
    expect(await count(`select count(*) as n from ${T.files}`)).toBe(0);
    expect(await count(`select count(*) as n from ${T.blobs}`)).toBe(0);
  });

  it('ภาพเก็บแบบเข้ารหัส และผู้สมัครเปิดดูภาพของตัวเองได้', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const original = documentImage(31);
    const up = await uploadKind(o, 'id', original);
    const { rows } = await dbQuery<{ bytes: Buffer }>(`select bytes from ${T.blobs} where file_id = $1`, [up.json.id]);
    expect(Buffer.from(rows[0].bytes).includes(original.subarray(0, 64))).toBe(false);
    const got = await call(publicHandler, { cookie: o.cookie, query: { action: 'file', k: o.k, id: up.json.id } });
    expect(got.status).toBe(200);
    expect(got.bytes!.equals(original)).toBe(true);
    expect(got.headers['content-type']).toBe('image/png');
    expect(got.headers['cache-control']).toContain('no-store');
    expect(got.headers['x-content-type-options']).toBe('nosniff');
  });

  it('DOC-027/028 เซิร์ฟเวอร์ไม่รับที่อยู่ที่อำเภอ/ตำบล/รหัสไปรษณีย์ไม่สัมพันธ์กัน', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const files = await uploadAll(o);
    const wrongDistrict = await submit(o, packetBody(o, files, (b) => (b.addresses.registered.districtId = '2001')));
    expect(wrongDistrict.status).toBe(400);
    const wrongZip = await submit(o, packetBody(o, files, (b) => (b.addresses.registered.postalCode = '99999')));
    expect(wrongZip.status).toBe(400);
    expect(await count(`select count(*) as n from ${T.packets}`)).toBe(0);
  });

  it('DOC-029 ที่อยู่ปัจจุบันเหมือนทะเบียนบ้าน: เก็บค่าจริงเท่ากัน ไม่อ้างค่าที่ส่งมาคนละชุด', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd, {
      patch: (b) => {
        b.addresses.sameAsRegistered = true;
        b.addresses.current = { house: 'ค่าอื่นที่ไม่ควรถูกใช้', moo: '', soi: '', road: '', provinceId: '', districtId: '', subdistrictId: '', postalCode: '' };
      },
    });
    const r = await detail(w.staffLbd, w.appLbd, s.packetId);
    expect(r.json.packet.addresses.sameAsRegistered).toBe(true);
    expect(r.json.packet.addresses.current).toBe(r.json.packet.addresses.registered);
    expect(r.json.packet.addresses.registered).toContain('99/1');
    expect(r.json.packet.addresses.registered).toContain('10200');
  });

  it('DOC-030/041/054 ปิดหน้าก่อนกดส่ง: ยังเป็นฉบับร่าง HR ไม่เห็นเป็นชุด ไม่มีแจ้งเตือน', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite, 'Ty');
    const files = await uploadAll(o);
    await settle();
    const r = await detail(w.staffLbd, w.appLbd);
    expect(r.json.status).toBe('opened');
    expect(r.json.packet).toBeNull();
    expect(r.json.packets).toEqual([]);
    expect(r.json.invitations[0].line.displayName).toBe('Ty');
    // ภาพฉบับร่างไม่ถูกเสิร์ฟให้เจ้าหน้าที่
    expect((await call(packetsHandler, { cookie: w.admin.cookie, query: { file: files[0].id } })).status).toBe(404);
    expect(await count(`select count(*) as n from ${T.outbox}`)).toBe(0);
    expect(await count(`select count(*) as n from ${T.notifications}`)).toBe(0);
    expect((await inbox(w.staffLbd)).json.items).toEqual([]);
    // ผู้สมัครกลับมาเปิดใหม่ (บัญชีเดิม) ฉบับร่างยังอยู่ ทำต่อได้
    const back = await openLink(link.invite, 'Ty', { sub: o.sub });
    expect(back.state.drafts.map((f: Json) => f.id).sort()).toEqual(files.map((f) => f.id).sort());
    expect(back.state.submitted).toBeNull();
  });
});

d('ยินยอมและลงนาม', () => {
  beforeEach(async () => {
    w = await world();
  });

  it('DOC-031 ต้นฉบับ 5 ประเภท ครบ 7 หน้า ไม่มีใบสมัครงาน และเปิดได้เฉพาะคนในลิงก์', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const docs = o.state.documents as { id: string; title: string; pages: number; answers: { value: string }[] }[];
    expect(docs.map((x) => x.id)).toEqual(['background', 'payroll', 'privacy', 'ex', 'reputation']);
    expect(docs.reduce((n, x) => n + x.pages, 0)).toBe(7);
    expect(docs.find((x) => x.id === 'ex')!.answers.map((a) => a.value)).toEqual(['yes']);
    expect(docs.some((x) => /ใบสมัคร/.test(x.title))).toBe(false);
    for (const doc of docs) {
      for (let page = 1; page <= doc.pages; page++) {
        const r = await call(publicHandler, { cookie: o.cookie, query: { action: 'template', k: o.k, doc: doc.id, page } });
        expect(r.status).toBe(200);
        expect(r.headers['content-type']).toBe('image/png');
      }
    }
    expect((await call(publicHandler, { cookie: o.cookie, query: { action: 'template', k: o.k, doc: 'ex', page: 4 } })).status).toBe(404);
    expect((await call(publicHandler, { cookie: o.cookie, query: { action: 'template', k: o.k, doc: 'application', page: 1 } })).status).toBe(404);
    // DOC-040: ไม่มีสิทธิ์ = เปิดต้นฉบับไม่ได้
    expect((await call(publicHandler, { query: { action: 'template', doc: 'ex', page: 1 } })).status).toBe(401);
    expect((await call(settingsHandler, { cookie: w.staffLbd.cookie, query: { template: 'ex', page: 1 } })).status).toBe(403);
    expect((await call(settingsHandler, { query: { template: 'ex', page: 1 } })).status).toBe(401);
  });

  it('DOC-032/034 คำตอบ ไม่ยินยอม / ขอคุย เก็บตามจริง ลายเซ็นไม่เปลี่ยนให้เป็นยินยอม และ HR เห็นเฉพาะจุด', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd, {
      patch: (b) => {
        b.consents.privacy = 'no';
        b.consents.payroll = 'discuss';
      },
    });
    const r = await detail(w.staffLbd, w.appLbd, s.packetId);
    const consents = Object.fromEntries(r.json.packet.consents.map((c: Json) => [c.doc, c]));
    expect(consents.privacy).toMatchObject({ answer: 'no', label: 'ไม่ให้ความยินยอม', followUp: true });
    expect(consents.payroll).toMatchObject({ answer: 'discuss', label: 'ขอให้เจ้าหน้าที่อธิบาย', followUp: true });
    expect(consents.background).toMatchObject({ answer: 'yes', followUp: false });
    expect(r.json.packet.signature.method).toBe('drawn');
    expect(r.json.status).toBe('needs_fix');
    expect(r.json.packet.attention.map((a: Json) => a.code).sort()).toEqual(['consent_declined', 'consent_discuss']);
    // ไม่มีอะไรไปแตะสถานะใบสมัคร (ไม่ตัดสินรับ/ไม่รับเอง)
    const { rows } = await dbQuery<{ status: string }>(`select status from ${T.applications} where id = $1`, [w.appLbd]);
    expect(rows[0].status).toBe('new');
    // PDF พิมพ์คำตอบตามจริง ไม่ใช่ "ยินยอม"
    expect((await call(packetsHandler, { cookie: w.staffLbd.cookie, query: { pdf: 'privacy', packetId: s.packetId } })).status).toBe(200);
  });

  it('DOC-033 ยังไม่ยอมรับสัญญา EX หรือไม่ตอบเอกสารใด = ส่งไม่ได้ (ไม่มีคำตอบติ๊กให้ล่วงหน้า)', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const files = await uploadAll(o);
    for (const patch of [
      (b: Json) => delete b.consents.ex,
      (b: Json) => (b.consents.ex = 'no'),
      (b: Json) => (b.consents.ex = ''),
      (b: Json) => delete b.consents.background,
      (b: Json) => (b.consents = {}),
      (b: Json) => delete b.consents,
    ]) {
      const r = await submit(o, packetBody(o, files, patch));
      expect(r.status).toBe(400);
    }
    expect(await count(`select count(*) as n from ${T.packets}`)).toBe(0);
  });

  it('DOC-035 ลายเซ็นเปล่า / โปร่งใสทั้งภาพ / จุดเดียว / ทึบทั้งแผ่น ไม่รับ', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const files = await uploadAll(o);
    const blank = png(320, 110, () => [0, 0, 0, 0]);
    const white = png(320, 110, () => [255, 255, 255, 255]);
    const dot = png(320, 110, (x, y) => (x > 100 && x < 104 && y > 50 && y < 54 ? [0, 0, 0, 255] : [0, 0, 0, 0]));
    const solid = png(320, 110, () => [20, 20, 20, 255]);
    for (const img of [blank, white, dot, solid]) {
      const r = await submit(o, packetBody(o, files, (b) => (b.signature.image = dataUrl(img))));
      expect(r.status).toBe(400);
      expect(r.json.error).toBe('invalid_signature');
    }
    const notPng = await submit(o, packetBody(o, files, (b) => (b.signature.image = 'data:image/png;base64,' + Buffer.from('x'.repeat(400)).toString('base64'))));
    expect(notPng.json.error).toBe('invalid_signature');
    const wrongName = await submit(o, packetBody(o, files, (b) => (b.signature.name = 'คนอื่น เซ็นแทน')));
    expect(wrongName.status).toBe(400);
    const noIntent = await submit(o, packetBody(o, files, (b) => (b.signatureIntent = false)));
    expect(noIntent.status).toBe(400);
    expect(await count(`select count(*) as n from ${T.packets}`)).toBe(0);
    expect((await submit(o, packetBody(o, files, (b) => (b.signature.image = dataUrl(signaturePng()))))).status).toBe(201);
  });

  it('ลงนามแบบพิมพ์ชื่อได้ เมื่อชื่อตรงกับที่กรอก', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd, { patch: (b) => (b.signature = { method: 'typed', name: 'ทดลอง อ่านเอกสาร', image: '' }) });
    const r = await detail(w.staffLbd, w.appLbd, s.packetId);
    expect(r.json.packet.signature).toMatchObject({ method: 'typed', name: 'ทดลอง อ่านเอกสาร' });
  });

  it('DOC-036 แบบฟอร์ม/ต้นฉบับเปลี่ยนรุ่นหลังอ่าน = ต้องเปิดอ่านและยืนยันใหม่ ไม่ใช้การยืนยันเก่า', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const files = await uploadAll(o);
    const staleForm = await submit(o, packetBody(o, files, (b) => (b.version = 'old-version')));
    expect(staleForm).toMatchObject({ status: 409, json: { error: 'stale_form' } });
    // ระหว่างที่ผู้สมัครกรอก บริษัทอัปโหลดสัญญา EX รุ่นใหม่
    await uploadTemplates(w.admin, ['ex']);
    const staleTemplate = await submit(o, packetBody(o, files));
    expect(staleTemplate).toMatchObject({ status: 409, json: { error: 'stale_template' } });
    expect(await count(`select count(*) as n from ${T.packets}`)).toBe(0);
    // เปิดใหม่ได้ต้นฉบับรุ่นใหม่ แล้วส่งได้
    const again = await openLink(link.invite, 'Ty', { sub: o.sub });
    expect(again.state.documents.find((x: Json) => x.id === 'ex').hash).not.toBe(o.state.documents.find((x: Json) => x.id === 'ex').hash);
    expect((await submit(again, packetBody(again, files))).status).toBe(201);
  });

  it('DOC-037 กดส่งซ้ำ / สองหน้าต่างส่งพร้อมกัน ได้ชุดเดียว ไม่สร้างซ้ำ', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const files = await uploadAll(o);
    const body = packetBody(o, files);
    const replies = await Promise.all([submit(o, body), submit(o, body), submit(o, body), submit(o, body)]);
    const ids = new Set(replies.map((r) => r.json.packetId));
    expect(ids.size).toBe(1);
    expect(replies.filter((r) => r.status === 201)).toHaveLength(1);
    expect(replies.filter((r) => r.status === 200 && r.json.already === true)).toHaveLength(3);
    expect(await count(`select count(*) as n from ${T.packets}`)).toBe(1);
    expect(await count(`select count(*) as n from ${T.outbox}`)).toBe(1);
    // เนื้อหาต่างจากชุดที่ส่งแล้ว = ไม่เขียนทับ
    const changed = await submit(o, packetBody(o, files, (b) => (b.consents.privacy = 'no')));
    expect(changed).toMatchObject({ status: 409, json: { error: 'already_sent' } });
    // แนบภาพเพิ่มหลังส่งไม่ได้
    expect((await uploadKind(o, 'id', documentImage(77))).status).toBe(409);
  });

  it('DOC-038 ส่งแล้วเน็ตหลุด: ถามสถานะเดิมได้ และส่งซ้ำได้รหัสชุดเดิม ไม่บอกสำเร็จโดยไม่มีรหัสชุด', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const files = await uploadAll(o);
    const body = packetBody(o, files);
    const first = await submit(o, body);
    expect(first.json.packetId).toMatch(/^[0-9a-f-]{36}$/);
    // หน้าเว็บไม่ได้รับคำตอบ → ถามสถานะก่อนลองใหม่
    const state = await call(publicHandler, { cookie: o.cookie, query: { action: 'state', k: o.k } });
    expect(state.json.submitted).toMatchObject({ packetId: first.json.packetId });
    const retry = await submit(o, body);
    expect(retry.json).toMatchObject({ packetId: first.json.packetId, already: true });
    const receipt = await call(publicHandler, { cookie: o.cookie, query: { action: 'receipt', k: o.k } });
    expect(receipt.json).toMatchObject({ packetId: first.json.packetId, personName: 'นายทดลอง อ่านเอกสาร' });
  });

  it('DOC-039 PDF 5 ฉบับ: ต้นฉบับครบหน้า + หน้าแนบท้ายจากชุดเดียวกัน · ไฟล์เดิมทุกครั้ง · DOC-040 คนนอกเปิดไม่ได้', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd);
    const pages: Record<string, number> = {};
    for (const doc of ['background', 'payroll', 'privacy', 'ex', 'reputation']) {
      const r = await call(packetsHandler, { cookie: w.staffLbd.cookie, query: { pdf: doc, packetId: s.packetId } });
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toBe('application/pdf');
      expect(r.headers['cache-control']).toContain('no-store');
      const pdf = await PDFDocument.load(r.bytes!);
      pages[doc] = pdf.getPageCount();
      expect(pdf.getTitle()).toContain('ทดลอง อ่านเอกสาร');
      expect(pdf.getSubject()).toContain(s.packetId);
      // เวลาในไฟล์ = เวลาที่ส่ง
      expect(pdf.getCreationDate()!.toISOString()).toBe(s.reply.json.submittedAt.replace(/\.\d+Z$/, '.000Z'));
      const again = await call(packetsHandler, { cookie: w.admin.cookie, query: { pdf: doc, packetId: s.packetId } });
      expect(again.bytes!.equals(r.bytes!)).toBe(true);
      expect(again.headers['x-document-sha256']).toBe(r.headers['x-document-sha256']);
    }
    // ต้นฉบับ 1/1/1/3/1 หน้า + หน้าแนบท้ายอย่างน้อย 1 หน้า
    expect(pages.ex).toBeGreaterThanOrEqual(4);
    for (const doc of ['background', 'payroll', 'privacy', 'reputation']) expect(pages[doc]).toBeGreaterThanOrEqual(2);
    expect(await count(`select count(*) as n from ${T.files} where kind like 'pdf:%'`)).toBe(5);
    // ผู้สมัครโหลดของตัวเองได้ คนอื่นไม่ได้
    expect((await call(publicHandler, { cookie: s.opened.cookie, query: { action: 'pdf', k: s.opened.k, doc: 'ex' } })).status).toBe(200);
    expect((await call(packetsHandler, { query: { pdf: 'ex', packetId: s.packetId } })).status).toBe(401);
    expect((await call(packetsHandler, { cookie: w.staffLba.cookie, query: { pdf: 'ex', packetId: s.packetId } })).status).toBe(403);
    expect((await call(packetsHandler, { cookie: w.staffLbd.cookie, query: { pdf: 'application', packetId: s.packetId } })).status).toBe(404);
  });

  it('ชุดที่ส่งแล้วแก้ไม่ได้และลบไม่ได้ที่ระดับฐานข้อมูล', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd);
    await expect(dbQuery(`update ${T.packets} set payload_hash = 'x' where id = $1`, [s.packetId])).rejects.toThrow(/แก้ไม่ได้/);
    await expect(dbQuery(`update ${T.packets} set person_name = 'x' where id = $1`, [s.packetId])).rejects.toThrow(/แก้ไม่ได้/);
    await expect(dbQuery(`delete from ${T.packets} where id = $1`, [s.packetId])).rejects.toThrow(/ลบ/);
  });
});

d('HR และการเปิดใช้', () => {
  beforeEach(async () => {
    w = await world();
  });

  it('DOC-042/043/021/023 ส่งสำเร็จ: HR เห็นชุดจริงครบ · ข้อมูลครบ = พร้อมนำเข้า ไม่มีขั้นอนุมัติทีละฉบับ', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd, {
      lineName: 'Ty',
      patch: (b) => {
        // OCR อ่านชื่อผิด ผู้สมัครแก้เอง — ต้องเห็นทั้งที่ OCR อ่านได้และที่แก้
        b.ocr.id.result.fields.firstName = 'ทดลอว';
      },
    });
    const r = await detail(w.staffLbd, w.appLbd, s.packetId);
    expect(r.status).toBe(200);
    expect(r.json.status).toBe('ready');
    expect(DOCUMENT_STATUS_LABEL.ready).toBe('พร้อมนำเข้า iRecruit');
    const p = r.json.packet;
    expect(p.personName).toBe('นายทดลอง อ่านเอกสาร');
    expect(p.person.find((x: Json) => x.key === 'nationalId').value).toBe(s.body.person.nationalId);
    expect(p.files.map((f: Json) => f.kind)).toEqual(['id', 'license', 'house']);
    expect(p.consents).toHaveLength(5);
    expect(p.signature.image).toMatch(/^data:image\/png;base64,/);
    expect(p.line).toMatchObject({ displayName: 'Ty', senderRelation: 'self', userId: s.opened.sub });
    expect(p.ocr.find((x: Json) => x.kind === 'id')).toMatchObject({ status: 'read', confidence: 88 });
    expect(p.ocr.find((x: Json) => x.kind === 'house').status).toBe('manual');
    expect(p.ocrEdits).toEqual([{ label: 'ชื่อ', ocr: 'ทดลอว', final: 'ทดลอง' }]);
    expect(p.attention).toEqual([]);
    expect(p.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    // ภาพในชุดเปิดได้ และตรงกับที่แนบ
    for (const f of p.files) {
      const img = await call(packetsHandler, { cookie: w.staffLbd.cookie, query: { file: f.id } });
      expect(img.status).toBe(200);
      expect(img.headers['content-type']).toBe('image/png');
    }
    // ข้อมูลในฐานเข้ารหัส: ไม่มีเลขบัตรเป็นข้อความตรง ๆ
    const { rows } = await dbQuery<{ payload_enc: string }>(`select payload_enc from ${T.packets} where id = $1`, [s.packetId]);
    expect(rows[0].payload_enc).not.toContain(s.body.person.nationalId);
    expect(Buffer.from(rows[0].payload_enc, 'base64').toString('latin1')).not.toContain(s.body.person.nationalId);
  });

  it('DOC-023 เลขบัตรกับเลขบนใบขับขี่ขัดกัน: ไม่เขียนทับ แสดงให้ HR ตรวจเฉพาะจุด', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd, { patch: (b) => (b.person.licenseNationalId = '0000000000001') });
    const r = await detail(w.staffLbd, w.appLbd, s.packetId);
    expect(r.json.status).toBe('needs_fix');
    expect(r.json.packet.attention).toEqual([{ code: 'national_id_mismatch', text: 'เลขบัตรประชาชนบนบัตรกับบนใบขับขี่ไม่ตรงกัน' }]);
    const person = Object.fromEntries(r.json.packet.person.map((x: Json) => [x.key, x.value]));
    expect(person.nationalId).toBe(s.body.person.nationalId);
    expect(person.licenseNationalId).toBe('0000000000001');
  });

  it('เลขบัตรไม่ผ่านหลักตรวจ: ต้องยืนยันเองก่อน แล้วส่งถึง HR พร้อมธง · บัตรหมดอายุเป็นเรื่องที่ HR เห็น', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const files = await uploadAll(o);
    const bad = (b: Json) => {
      b.person.nationalId = '1234567890123';
      b.person.licenseNationalId = '1234567890123';
    };
    expect((await submit(o, packetBody(o, files, bad))).json.error).toBe('national_id_checksum');
    const ok = await submit(o, packetBody(o, files, (b) => {
      bad(b);
      b.person.nationalIdConfirmed = true;
      b.person.idExpiry = '2020-01-01';
    }));
    expect(ok.status).toBe(201);
    const r = await detail(w.staffLbd, w.appLbd, ok.json.packetId);
    expect(r.json.packet.attention.map((a: Json) => a.code).sort()).toEqual(['id_expired', 'national_id_checksum']);
  });

  it('DOC-044 ไฟล์แนบเดิมของใบสมัคร (CV) ยังอยู่ ไม่ถูกภาพชุดเอกสารเขียนทับ', async () => {
    await fullSubmission(w.staffLbd, w.appLbd);
    const { rows } = await dbQuery<{ document_filename: string; document_mime: string; document_bytes: Buffer }>(
      `select document_filename, document_mime, document_bytes from ${T.applications} where id = $1`,
      [w.appLbd],
    );
    expect(rows[0].document_filename).toBe('cv.pdf');
    expect(rows[0].document_mime).toBe('application/pdf');
    expect(Buffer.from(rows[0].document_bytes).toString()).toBe('%PDF-test');
  });

  it('DOC-045/046 รายการมากกว่า 10: แบ่งหน้าไม่ซ้ำไม่หาย · กรองสถานะ/BU/ค้นชื่อ ได้เฉพาะที่ขอ', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 23; i++) {
      const id = await addApplication(`ผู้สมัครจำลอง ${String(i).padStart(2, '0')}`, i % 2 ? 'LBA' : 'LBD');
      ids.push(id);
      const link = await createLink(w.admin, id);
      if (i % 3 === 0) await openLink(link.invite, `ไลน์ ${i}`);
    }
    const seen: string[] = [];
    let total = 0;
    for (let page = 1; page <= 4; page++) {
      const r = await list(w.admin, { page, pageSize: 10 });
      total = r.json.total;
      seen.push(...r.json.items.map((x: Json) => x.applicationId));
      expect(r.json.items.length).toBeLessThanOrEqual(10);
    }
    expect(total).toBe(23);
    expect(new Set(seen).size).toBe(23);
    expect([...seen].sort()).toEqual([...ids].sort());
    const lbd = await list(w.admin, { bu: 'LBD', pageSize: 50 });
    expect(lbd.json.total).toBe(12);
    expect(lbd.json.items.every((x: Json) => x.bu === 'LBD')).toBe(true);
    const opened = await list(w.admin, { status: 'opened', pageSize: 50 });
    expect(opened.json.total).toBe(8);
    expect(opened.json.items.every((x: Json) => x.status === 'opened' && x.line)).toBe(true);
    expect(opened.json.counts).toEqual({ opened: 8, not_opened: 15 });
    const search = await list(w.admin, { q: 'จำลอง 07' });
    expect(search.json.items.map((x: Json) => x.applicantName)).toEqual(['ผู้สมัครจำลอง 07']);
    // คนที่ถูกล็อก BU เห็นเฉพาะของตัวเอง แม้ขอ BU อื่น
    const scoped = await list(w.staffLbd, { bu: 'LBA', pageSize: 50 });
    expect(scoped.json.total).toBe(0);
    expect((await list(w.staffLbd, { pageSize: 50 })).json.total).toBe(12);
  });

  it('สถานะที่ฐานคิด (ตัวกรอง) ตรงกับสถานะในหน้ารายละเอียดทุกกรณี', async () => {
    const cases: Record<string, string> = {};
    const notOpened = await addApplication('ยังไม่เปิด', 'LBD');
    await createLink(w.admin, notOpened);
    cases[notOpened] = 'not_opened';
    const opened = await addApplication('เปิดแล้ว', 'LBD');
    await openLink((await createLink(w.admin, opened)).invite);
    cases[opened] = 'opened';
    const expired = await addApplication('หมดอายุ', 'LBD');
    const e = await createLink(w.admin, expired);
    await dbQuery(`update ${T.invitations} set expires_at = now() - interval '1 hour' where id = $1`, [e.invitationId]);
    cases[expired] = 'link_expired';
    const ready = await addApplication('พร้อม', 'LBD');
    await fullSubmission(w.admin, ready);
    cases[ready] = 'ready';
    const fix = await addApplication('ต้องแก้', 'LBD');
    await fullSubmission(w.admin, fix, { patch: (b) => (b.consents.reputation = 'discuss') });
    cases[fix] = 'needs_fix';
    const newer = await addApplication('ส่งแล้วมีลิงก์ใหม่', 'LBD');
    await fullSubmission(w.admin, newer);
    await new Promise((r) => setTimeout(r, 15));
    await createLink(w.admin, newer);
    cases[newer] = 'not_opened';
    const newerDead = await addApplication('ส่งแล้วลิงก์ใหม่ถูกยกเลิก', 'LBD');
    await fullSubmission(w.admin, newerDead);
    await new Promise((r) => setTimeout(r, 15));
    const dead = await createLink(w.admin, newerDead);
    await call(invitationsHandler, { method: 'POST', cookie: w.admin.cookie, body: { action: 'revoke', invitationId: dead.invitationId } });
    cases[newerDead] = 'ready';

    const rows = (await list(w.admin, { pageSize: 50 })).json.items as { applicationId: string; status: string }[];
    for (const [applicationId, expected] of Object.entries(cases)) {
      expect(rows.find((r) => r.applicationId === applicationId)?.status, applicationId).toBe(expected);
      expect((await detail(w.admin, applicationId)).json.status, applicationId).toBe(expected);
    }
  });

  it('DOC-047/049 HR บันทึกนำเข้า: ต้องเลือกแผนก · ต้องมีเลขที่จาก iRecruit · มี audit · ไม่ซ้ำ', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd);
    const post = (body: Record<string, unknown>) => call(packetsHandler, { method: 'POST', cookie: w.staffLbd.cookie, body });
    // ยังไม่ได้เชื่อม iRecruit: ปุ่มนำเข้าอัตโนมัติตอบตรง ๆ ว่ายังไม่เชื่อม ไม่ทำเป็นสำเร็จ
    const auto = await post({ action: 'import', packetId: s.packetId, department: 'LB', idempotencyKey: 'key-00000001' });
    expect(auto).toMatchObject({ status: 503, json: { error: 'irecruit_not_connected' } });
    expect((await post({ action: 'import-record', packetId: s.packetId, externalId: 'A-1001' })).status).toBe(400);
    expect((await post({ action: 'import-record', packetId: s.packetId, department: 'ZZ', externalId: 'A-1001' })).status).toBe(400);
    expect((await post({ action: 'import-record', packetId: s.packetId, department: 'LB', externalId: '' })).status).toBe(400);
    expect((await detail(w.staffLbd, w.appLbd)).json.status).toBe('ready');
    const ok = await post({ action: 'import-record', packetId: s.packetId, department: 'LB', externalId: 'A-1001' });
    expect(ok.json).toMatchObject({ status: 'success', externalId: 'A-1001', department: 'LB', mode: 'manual' });
    const r = await detail(w.staffLbd, w.appLbd);
    expect(r.json.status).toBe('imported');
    expect(r.json.packet.imports[0]).toMatchObject({ status: 'success', externalId: 'A-1001' });
    expect((await post({ action: 'import-record', packetId: s.packetId, department: 'LB', externalId: 'A-1002' })).json.error).toBe('already_imported');
    expect(await count(`select count(*) as n from ${T.imports}`)).toBe(1);
    expect(await count(`select count(*) as n from jarvis_rm.audit_logs where action = 'document_packet.import_record'`)).toBe(1);
    // คนอ่านอย่างเดียว / BU อื่น ทำไม่ได้
    expect((await call(packetsHandler, { method: 'POST', cookie: w.oplLbd.cookie, body: { action: 'import-record', packetId: s.packetId, department: 'LB', externalId: 'B-1' } })).status).toBe(403);
    expect((await call(packetsHandler, { method: 'POST', cookie: w.staffLba.cookie, body: { action: 'flag', packetId: s.packetId, note: 'x' } })).status).toBe(403);
  });

  it('DOC-048 นำเข้าผ่านตัวต่อแล้วการเชื่อมต่อขาด: สถานะ "ไม่รู้ผล" ห้ามลองใหม่จนตรวจ ไม่สร้างซ้ำ', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd);
    const post = (body: Record<string, unknown>) => call(packetsHandler, { method: 'POST', cookie: w.staffLbd.cookie, body });
    let calls = 0;
    let mode: 'timeout' | 'ok' | 'reject' = 'timeout';
    let existing: string | null = null;
    setIrecruitExportAdapter({
      configured: () => true,
      createApplicant: async () => {
        calls++;
        if (mode === 'timeout') throw new Error('socket hang up');
        if (mode === 'reject') return { ok: false, error: 'เลขบัตรนี้มีใน iRecruit แล้ว' };
        return { ok: true, externalId: 'IR-777' };
      },
      findExisting: async () => existing,
    });
    try {
      const first = await post({ action: 'import', packetId: s.packetId, department: 'LB', idempotencyKey: 'attempt-0001' });
      expect(first.json).toMatchObject({ status: 'unknown', externalId: null });
      expect((await detail(w.staffLbd, w.appLbd)).json.status).toBe('ready');
      // กดซ้ำด้วยคีย์เดิม = ได้รอบเดิม ไม่ยิงปลายทางอีก
      const same = await post({ action: 'import', packetId: s.packetId, department: 'LB', idempotencyKey: 'attempt-0001' });
      expect(same.json.id).toBe(first.json.id);
      // รอบใหม่ระหว่างยังไม่รู้ผล = ไม่ให้
      mode = 'ok';
      const second = await post({ action: 'import', packetId: s.packetId, department: 'LB', idempotencyKey: 'attempt-0002' });
      expect(second).toMatchObject({ status: 409, json: { error: 'import_unknown' } });
      expect((await post({ action: 'import-record', packetId: s.packetId, department: 'LB', externalId: 'X-1' })).json.error).toBe('import_unknown');
      expect(calls).toBe(1);
      // ตรวจกับปลายทาง: ยังหาไม่เจอ = ยังไม่รู้ผล
      expect((await post({ action: 'import-resolve', attemptId: first.json.id })).json.error).toBe('still_unknown');
      // ปลายทางสร้างไปแล้วจริง → ได้เลขที่เดิม ไม่สร้างใหม่
      existing = 'IR-555';
      const resolved = await post({ action: 'import-resolve', attemptId: first.json.id });
      expect(resolved.json).toMatchObject({ status: 'success', externalId: 'IR-555' });
      expect(calls).toBe(1);
      expect((await detail(w.staffLbd, w.appLbd)).json.status).toBe('imported');
      expect(await count(`select count(*) as n from ${T.imports}`)).toBe(1);
    } finally {
      setIrecruitExportAdapter(null);
    }
  });

  it('DOC-049 ตัวต่อตอบสำเร็จต้องมีเลขที่ · ปลายทางปฏิเสธ = ล้ม ลองใหม่ได้', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd);
    const post = (body: Record<string, unknown>) => call(packetsHandler, { method: 'POST', cookie: w.staffLbd.cookie, body });
    let reply: Json = { ok: true, externalId: '   ' };
    setIrecruitExportAdapter({ configured: () => true, createApplicant: async () => reply });
    try {
      const noId = await post({ action: 'import', packetId: s.packetId, department: 'DS', idempotencyKey: 'attempt-1001' });
      expect(noId.json.status).toBe('failed');
      expect((await detail(w.staffLbd, w.appLbd)).json.status).toBe('ready');
      reply = { ok: false, error: 'ปลายทางปฏิเสธ' };
      expect((await post({ action: 'import', packetId: s.packetId, department: 'DS', idempotencyKey: 'attempt-1002' })).json).toMatchObject({ status: 'failed', error: 'ปลายทางปฏิเสธ' });
      reply = { ok: true, externalId: 'IR-9', evidence: { url: '/applicants/9' } };
      expect((await post({ action: 'import', packetId: s.packetId, department: 'DS', idempotencyKey: 'attempt-1003' })).json).toMatchObject({ status: 'success', externalId: 'IR-9' });
      expect((await detail(w.staffLbd, w.appLbd)).json.status).toBe('imported');
    } finally {
      setIrecruitExportAdapter(null);
    }
  });

  it('DOC-050 ส่งฟอร์มเอกสารอย่างเดียว: ไม่มีการนำเข้าเอง ไม่เปลี่ยนใบสมัคร/ผลนัด', async () => {
    const before = (await dbQuery(`select * from ${T.applications} where id = $1`, [w.appLbd])).rows[0];
    let exportCalls = 0;
    setIrecruitExportAdapter({ configured: () => true, createApplicant: async () => (exportCalls++, { ok: true, externalId: 'X' }) });
    try {
      await fullSubmission(w.staffLbd, w.appLbd);
      await settle();
    } finally {
      setIrecruitExportAdapter(null);
    }
    expect(exportCalls).toBe(0);
    expect(await count(`select count(*) as n from ${T.imports}`)).toBe(0);
    const after = (await dbQuery(`select * from ${T.applications} where id = $1`, [w.appLbd])).rows[0];
    expect(after).toEqual(before);
  });

  it('มีเรื่องต้องดู: HR ติดธงขอให้แก้ / รับทราบแล้วจึงนำเข้าได้ — คำตอบในชุดไม่ถูกเปลี่ยน', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd, { patch: (b) => (b.consents.payroll = 'discuss') });
    const post = (body: Record<string, unknown>) => call(packetsHandler, { method: 'POST', cookie: w.staffLbd.cookie, body });
    expect((await post({ action: 'import-record', packetId: s.packetId, department: 'LB', externalId: 'A-1' })).json.error).toBe('needs_fix');
    expect((await post({ action: 'ack', packetId: s.packetId, note: '' })).status).toBe(400);
    expect((await post({ action: 'ack', packetId: s.packetId, note: 'โทรอธิบาย Tik Tack แล้ว ผู้สมัครรับทราบ' })).status).toBe(200);
    let r = await detail(w.staffLbd, w.appLbd);
    expect(r.json.status).toBe('ready');
    expect(r.json.packet.consents.find((c: Json) => c.doc === 'payroll').answer).toBe('discuss');
    expect(r.json.packet.attentionAck.note).toContain('Tik Tack');
    expect((await post({ action: 'flag', packetId: s.packetId, note: '' })).status).toBe(400);
    expect((await post({ action: 'flag', packetId: s.packetId, note: 'รูปทะเบียนบ้านไม่ใช่หน้าที่มีชื่อ' })).status).toBe(200);
    r = await detail(w.staffLbd, w.appLbd);
    expect(r.json.status).toBe('needs_fix');
    expect(r.json.packet.review).toMatchObject({ flag: true, note: 'รูปทะเบียนบ้านไม่ใช่หน้าที่มีชื่อ' });
    expect((await post({ action: 'unflag', packetId: s.packetId })).status).toBe(200);
    expect((await detail(w.staffLbd, w.appLbd)).json.status).toBe('ready');
    const types = (await detail(w.staffLbd, w.appLbd)).json.events.map((e: Json) => e.type);
    expect(types).toEqual(expect.arrayContaining(['attention_acknowledged', 'review_flagged', 'review_cleared', 'submitted', 'opened', 'link_created']));
  });

  it('DOC-051 ปิดฟีเจอร์: สร้างลิงก์ใหม่ไม่ได้ ผู้สมัครเปิดไม่ได้ ของที่ส่งแล้วยังดูได้ ไฟล์แนบเดิมยังอยู่', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd);
    const pending = await createLink(w.staffLba, w.appLba);
    const off = await call(settingsHandler, { method: 'PUT', cookie: w.admin.cookie, body: { enabled: false } });
    expect(off.status).toBe(200);
    clearDocumentSettingsCache();
    const create = await call(invitationsHandler, { method: 'POST', cookie: w.staffLbd.cookie, body: { applicationId: w.appLbd } });
    expect(create).toMatchObject({ status: 409, json: { error: 'documents_disabled' } });
    expect((await openLink(pending.invite)).reply).toMatchObject({ status: 503, json: { error: 'documents_disabled' } });
    expect((await call(publicHandler, { query: { action: 'config' } })).json.enabled).toBe(false);
    // ของเดิมยังอ่านได้ตามสิทธิ์
    const r = await detail(w.staffLbd, w.appLbd, s.packetId);
    expect(r.status).toBe(200);
    expect(r.json.packet.files).toHaveLength(3);
    expect((await call(packetsHandler, { cookie: w.staffLbd.cookie, query: { pdf: 'ex', packetId: s.packetId } })).status).toBe(200);
    const st = await call(settingsHandler, { cookie: w.staffLbd.cookie });
    expect(st.json).toEqual({ enabled: false, ready: false, hasHistory: true });
    expect(await count(`select count(*) as n from ${T.applications} where document_bytes is not null`)).toBe(1);
  });

  it('เปิดใช้ไม่ได้ถ้ายังตั้งไม่ครบ และคนทั่วไปแก้ค่าไม่ได้', async () => {
    await resetAll();
    const admin = await addUser('admin', null);
    const staff = await addUser('staff', 'LBD');
    const app = await addApplication('ยังไม่พร้อม', 'LBD');
    const blocked = await call(settingsHandler, { method: 'PUT', cookie: admin.cookie, body: { enabled: true } });
    expect(blocked).toMatchObject({ status: 409, json: { error: 'not_ready' } });
    await uploadTemplates(admin, ['background', 'payroll', 'privacy', 'ex']);
    expect((await call(settingsHandler, { method: 'PUT', cookie: admin.cookie, body: { enabled: true } })).json.message).toContain('1 ประเภท');
    expect((await call(invitationsHandler, { method: 'POST', cookie: staff.cookie, body: { applicationId: app } })).json.error).toBe('documents_disabled');
    expect((await call(settingsHandler, { method: 'PUT', cookie: staff.cookie, body: { enabled: true } })).status).toBe(403);
    expect((await call(settingsHandler, { method: 'POST', cookie: staff.cookie, body: { action: 'template', docType: 'reputation', pages: [] } })).status).toBe(403);
    await uploadTemplates(admin, ['reputation']);
    await enableFeature(admin);
    expect((await call(invitationsHandler, { method: 'POST', cookie: staff.cookie, body: { applicationId: app } })).status).toBe(201);
    expect((await call(settingsHandler, { method: 'PUT', cookie: admin.cookie, body: { liffId: 'ไม่ใช่รูปแบบ' } })).status).toBe(400);
    const view = await call(settingsHandler, { cookie: admin.cookie });
    expect(view.json.templates.map((t: Json) => t.pages)).toEqual([1, 1, 1, 3, 1]);
  });
});

d('แจ้งเตือนเอกสาร', () => {
  beforeEach(async () => {
    w = await world();
  });

  it('DOC-053/055 ส่งสำเร็จ: คนสร้างลิงก์ได้แจ้งเตือน 1 อัน กดแล้วชี้ใบสมัคร + ชุดนั้น', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd);
    await settle();
    const mine = await inbox(w.staffLbd);
    expect(mine.json.unread).toBe(1);
    const n = mine.json.items[0];
    expect(n).toMatchObject({ type: 'document_packet_submitted', title: 'สมมติ ทดลองระบบ ส่งเอกสารแล้ว', readAt: null });
    expect(n.body).toContain('พนักงานขับรถ');
    expect(parseDocumentsDeepLink(n.link.split('?')[1])).toEqual({ applicationId: w.appLbd, packetId: s.packetId });
    // ลิงก์ไม่มีรหัสลิงก์ของผู้สมัคร เลขบัตร เบอร์
    expect(n.link).not.toContain(s.link.invite);
    expect(JSON.stringify(n)).not.toContain(s.body.person.nationalId);
    expect(JSON.stringify(n)).not.toContain(s.body.person.phone);
    // เปิดตามลิงก์ = ได้ชุดนั้น
    const open = await detail(w.staffLbd, w.appLbd, s.packetId);
    expect(open.json.packet.id).toBe(s.packetId);
    // คนอื่นไม่ได้รับ
    for (const u of [w.admin, w.staffLba, w.supervisorLbd, w.oplLbd]) expect((await inbox(u)).json.items).toEqual([]);
  });

  it('DOC-056 ส่งซ้ำ / ตัวส่งวิ่งซ้ำ: แจ้งคนเดิมครั้งเดียวต่อชุด', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd);
    await submit(s.opened, s.body);
    await submit(s.opened, s.body);
    await Promise.all([dispatchDueOutbox(), dispatchDueOutbox(), dispatchDueOutbox()]);
    await settle();
    await dbQuery(`update ${T.outbox} set status = 'pending', next_attempt_at = now()`);
    await dispatchDueOutbox();
    expect(await count(`select count(*) as n from ${T.notifications}`)).toBe(1);
    expect(await count(`select count(*) as n from ${T.outbox} where status = 'delivered'`)).toBe(1);
  });

  it('DOC-057 เขียนแจ้งเตือนล้มหลังชุดบันทึกแล้ว: ชุดยังอยู่ คิวยังค้าง ลองใหม่แล้วถึง ไม่หายเงียบ', async () => {
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const files = await uploadAll(o);
    // ทำให้กล่องแจ้งเตือนรับแถวไม่ได้ชั่วคราว
    await dbQuery(`alter table ${T.notifications} add constraint docs_test_block check (type <> 'document_packet_submitted')`);
    try {
      const sent = await submit(o, packetBody(o, files));
      expect(sent.status).toBe(201);
      await settle();
      expect(await count(`select count(*) as n from ${T.packets}`)).toBe(1);
      const { rows } = await dbQuery<{ status: string; attempts: number; last_error: string; next_attempt_at: Date }>(`select status, attempts, last_error, next_attempt_at from ${T.outbox}`);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('pending');
      expect(rows[0].attempts).toBeGreaterThanOrEqual(1);
      expect(rows[0].last_error).toContain('docs_test_block');
      expect(new Date(rows[0].next_attempt_at).getTime()).toBeGreaterThan(Date.now());
      expect((await inbox(w.staffLbd)).json.items).toEqual([]);
      // ผู้สมัครไม่ต้องส่งใหม่: ส่งซ้ำได้ชุดเดิม
      expect((await submit(o, packetBody(o, files))).json.already).toBe(true);
    } finally {
      await dbQuery(`alter table ${T.notifications} drop constraint docs_test_block`);
    }
    await dbQuery(`update ${T.outbox} set next_attempt_at = now()`);
    const r = await dispatchDueOutbox();
    expect(r).toEqual({ delivered: 1, failed: 0 });
    expect((await inbox(w.staffLbd)).json.unread).toBe(1);
    expect(await count(`select count(*) as n from ${T.packets}`)).toBe(1);
  });

  it('ตัวเขียนแจ้งเตือนที่ไม่ได้เขียนจริง ไม่ถูกนับว่าส่งแล้ว', async () => {
    await fullSubmission(w.staffLbd, w.appLbd);
    await new Promise((r) => setTimeout(r, 30));
    await dbQuery(`delete from ${T.notifications}`);
    await dbQuery(`update ${T.outbox} set status = 'pending', next_attempt_at = now(), delivered_at = null`);
    // ตัวเขียนที่ "คืนค่าเฉย ๆ" แบบ notifyUsers เดิม — ระบบต้องไม่เชื่อ
    const { strictNotificationWriter } = await import('../../../api/_lib/documents/outbox');
    const silent = await dispatchDueOutbox({
      writer: async (client, userIds, row) => {
        await client.query('select 1');
        void userIds;
        void row;
        throw new Error('insert failed silently upstream');
      },
    });
    expect(silent).toEqual({ delivered: 0, failed: 1 });
    expect(await count(`select count(*) as n from ${T.outbox} where status = 'delivered'`)).toBe(0);
    await dbQuery(`update ${T.outbox} set next_attempt_at = now()`);
    expect(await dispatchDueOutbox({ writer: strictNotificationWriter })).toEqual({ delivered: 1, failed: 0 });
  });

  it('DOC-058 ผู้รับไม่ได้ออนไลน์: แจ้งเตือนเก็บไว้ ยังไม่อ่าน จนกลับมาเปิด · อ่านแล้วไม่เปลี่ยนสถานะเอกสาร', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd);
    await settle();
    await dbQuery(`update ${T.notifications} set created_at = now() - interval '20 days'`);
    const later = await inbox(w.staffLbd);
    expect(later.json.items.map((n: Json) => n.type)).toEqual(['document_packet_submitted']);
    expect(later.json.unread).toBe(1);
    const read = await call(notificationsHandler, { method: 'PATCH', cookie: w.staffLbd.cookie, body: { ids: [later.json.items[0].id] } });
    expect(read.status).toBe(200);
    expect((await inbox(w.staffLbd)).json.unread).toBe(0);
    // DOC-064: อ่านแจ้งเตือน ≠ ตรวจ/นำเข้า
    const r = await detail(w.staffLbd, w.appLbd, s.packetId);
    expect(r.json.status).toBe('ready');
    expect(r.json.packet.imports).toEqual([]);
    expect(await count(`select count(*) as n from ${T.imports}`)).toBe(0);
  });

  it('DOC-059 บัญชีอื่นอ่านกล่องแจ้งเตือน/กดอ่านของคนอื่นไม่ได้ และปลายทางตรวจสิทธิ์ใหม่เสมอ', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd);
    await settle();
    const id = (await inbox(w.staffLbd)).json.items[0].id;
    expect((await inbox(w.staffLba)).json.items).toEqual([]);
    await call(notificationsHandler, { method: 'PATCH', cookie: w.staffLba.cookie, body: { ids: [id] } });
    expect((await inbox(w.staffLbd)).json.unread).toBe(1);
    // ถือลิงก์ของแจ้งเตือนแต่ไม่มีสิทธิ์ BU = ไม่ได้ข้อมูล
    const peek = await detail(w.staffLba, w.appLbd, s.packetId);
    expect(peek.status).toBe(403);
    expect(JSON.stringify(peek.json)).not.toContain('ทดลอง');
    // ผู้รับถูกย้าย BU ภายหลัง: แจ้งเตือนยังอยู่ แต่เปิดเอกสารไม่ได้
    await dbQuery(`update ${T.users} set department_code = 'LBA' where id = $1`, [w.staffLbd.id]);
    expect((await detail(w.staffLbd, w.appLbd, s.packetId)).status).toBe(403);
    expect((await call(packetsHandler, { cookie: w.staffLbd.cookie, query: { file: s.files[0].id } })).status).toBe(403);
  });

  it('DOC-060 แจ้งเตือนอื่นเข้ามาเกินเพดาน: แจ้งเตือนเอกสารที่ยังไม่อ่านไม่หาย และมีประวัติแบ่งหน้า', async () => {
    const apps: string[] = [];
    for (let i = 0; i < 4; i++) {
      const id = await addApplication(`เอกสารค้างอ่าน ${i}`, 'LBD');
      apps.push(id);
      await fullSubmission(w.staffLbd, id);
    }
    await settle();
    await dbQuery(`update ${T.notifications} set created_at = now() - interval '30 days'`);
    await dbQuery(
      `insert into ${T.notifications} (recipient_user_id, type, title) select $1, 'needs_human', 'AI ยังไม่โทร ' || g from generate_series(1, 400) g`,
      [w.staffLbd.id],
    );
    const r = await inbox(w.staffLbd);
    const docs = r.json.items.filter((n: Json) => n.type === 'document_packet_submitted');
    expect(docs).toHaveLength(4);
    expect(docs.every((n: Json) => n.readAt === null)).toBe(true);
    // ประวัติทีละหน้า
    const p1 = await call(notificationsHandler, { cookie: w.staffLbd.cookie, query: { history: 'document_packet_submitted', limit: 3 } });
    expect(p1.json.items).toHaveLength(3);
    expect(p1.json.nextBefore).toBeTruthy();
    const p2 = await call(notificationsHandler, { cookie: w.staffLbd.cookie, query: { history: 'document_packet_submitted', limit: 3, before: p1.json.nextBefore } });
    expect(p2.json.items).toHaveLength(1);
    expect(p2.json.nextBefore).toBeNull();
    const ids = [...p1.json.items, ...p2.json.items].map((n: Json) => n.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('DOC-061 เอกสารหลายชุดของคนเดียว: แต่ละแจ้งเตือนเปิดชุดของตัวเอง ไม่แทนด้วยชุดล่าสุด', async () => {
    const first = await fullSubmission(w.staffLbd, w.appLbd, { patch: (b) => (b.consents.reputation = 'discuss') });
    await new Promise((r) => setTimeout(r, 15));
    const second = await fullSubmission(w.staffLbd, w.appLbd);
    await settle();
    const items = (await inbox(w.staffLbd)).json.items as { link: string }[];
    expect(items).toHaveLength(2);
    const targets = items.map((n) => parseDocumentsDeepLink(n.link.split('?')[1]).packetId).sort();
    expect(targets).toEqual([first.packetId, second.packetId].sort());
    const a = await detail(w.staffLbd, w.appLbd, first.packetId);
    const b = await detail(w.staffLbd, w.appLbd, second.packetId);
    expect(a.json.packet.id).toBe(first.packetId);
    expect(a.json.packet.revision).toBe(1);
    expect(a.json.packet.consents.find((c: Json) => c.doc === 'reputation').answer).toBe('discuss');
    expect(b.json.packet.id).toBe(second.packetId);
    expect(b.json.packet.revision).toBe(2);
    expect(b.json.packets).toHaveLength(2);
    // ไม่ระบุชุด = ชุดล่าสุด
    expect((await detail(w.staffLbd, w.appLbd)).json.packet.id).toBe(second.packetId);
  });

  it('DOC-062 คนสร้างลิงก์ถูกปิดบัญชี/ไม่มีสิทธิ์: ส่งต่อหัวหน้างานของ BU เดียวกัน จดเหตุ ไม่กระจายทุกคน', async () => {
    const supervisorLba = await addUser('supervisor', 'LBA');
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite);
    const files = await uploadAll(o);
    await dbQuery(`update ${T.users} set is_active = false where id = $1`, [w.staffLbd.id]);
    expect((await submit(o, packetBody(o, files))).status).toBe(201);
    await settle();
    expect((await inbox(w.supervisorLbd)).json.items).toHaveLength(1);
    for (const u of [supervisorLba, w.staffLba, w.admin, w.oplLbd]) expect((await inbox(u)).json.items).toEqual([]);
    expect(await count(`select count(*) as n from ${T.notifications} where recipient_user_id = $1`, [w.staffLbd.id])).toBe(0);
    const { rows } = await dbQuery<{ delivered_to: { fallback: string; userIds: string[] } }>(`select delivered_to from ${T.outbox}`);
    expect(rows[0].delivered_to).toEqual({ fallback: 'creator_inactive', userIds: [w.supervisorLbd.id] });

    // BU ที่ไม่มีหัวหน้างาน → ผู้ดูแลระบบ
    const lm = await addApplication('ไม่มีหัวหน้า', 'LM');
    const creator = await addUser('staff', 'LM');
    const l2 = await createLink(creator, lm);
    const o2 = await openLink(l2.invite);
    const f2 = await uploadAll(o2, 300);
    await dbQuery(`update ${T.users} set department_code = 'SN' where id = $1`, [creator.id]);
    await submit(o2, packetBody(o2, f2));
    await settle();
    expect((await inbox(w.admin)).json.items).toHaveLength(1);
    expect((await inbox(creator)).json.items).toEqual([]);
    const last = await dbQuery<{ delivered_to: { fallback: string } }>(`select delivered_to from ${T.outbox} order by id desc limit 1`);
    expect(last.rows[0].delivered_to.fallback).toBe('creator_no_access');
  });

  it('DOC-063 หน้าเว็บของคนสร้างลิงก์ถามถี่ขึ้นเฉพาะช่วงที่มีผู้สมัครเปิดลิงก์อยู่', async () => {
    expect((await inbox(w.staffLbd)).json.fastUntil).toBeNull();
    const link = await createLink(w.staffLbd, w.appLbd);
    expect(await documentWatchUntil(w.staffLbd.id)).toBeNull();
    const o = await openLink(link.invite);
    const until = (await inbox(w.staffLbd)).json.fastUntil;
    expect(Date.parse(until)).toBeGreaterThan(Date.now() + 2 * 3_600_000);
    expect((await inbox(w.staffLba)).json.fastUntil).toBeNull();
    const files = await uploadAll(o);
    await submit(o, packetBody(o, files));
    await settle();
    expect((await inbox(w.staffLbd)).json.fastUntil).toBeNull();
    // ส่งถึงกล่องแจ้งเตือนทันทีหลังชุดบันทึก (ไม่รอรอบของตัวเฝ้า)
    const { rows } = await dbQuery<{ lag: number }>(
      `select extract(epoch from (o.delivered_at - p.submitted_at)) as lag from ${T.outbox} o join ${T.packets} p on p.id = o.packet_id`,
    );
    expect(Number(rows[0].lag)).toBeLessThan(5);
  });

  it('เหตุการณ์และ audit ครบ: ใครสร้าง ใครเปิด ใครส่ง · log ไม่มีรหัสลิงก์', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd, { lineName: 'Ty' });
    await settle();
    const r = await detail(w.staffLbd, w.appLbd);
    const byType = Object.fromEntries(r.json.events.map((e: Json) => [e.type, e]));
    expect(byType.link_created).toMatchObject({ actorType: 'staff', actorName: 'เจ้าหน้าที่ LBD' });
    expect(byType.opened).toMatchObject({ actorType: 'applicant', actorName: 'Ty' });
    expect(byType.submitted).toMatchObject({ actorType: 'applicant' });
    expect(byType.notification_delivered).toMatchObject({ actorType: 'system' });
    const { rows } = await dbQuery<{ action: string; new_value: string | null }>(`select action, coalesce(new_value::text, '') as new_value from jarvis_rm.audit_logs order by 1`);
    expect(rows.map((x) => x.action)).toEqual(expect.arrayContaining(['document_invitation.create', 'document_packet.submit', 'document_template.upload', 'document_settings.update']));
    const all = JSON.stringify(rows) + JSON.stringify(r.json.events);
    expect(all).not.toContain(s.link.invite);
    expect(all).not.toContain(s.body.person.nationalId);
    void cookieOf;
    void mockLineToken;
  });

  it('ลบข้อมูลตามคำขอ PDPA: ภาพ ข้อมูลในชุด บัญชี LINE ชื่อในแจ้งเตือน ถูกล้าง · ลิงก์ใช้ต่อไม่ได้ · แถวนับสถิติยังอยู่', async () => {
    const s = await fullSubmission(w.staffLbd, w.appLbd, { lineName: 'Ty' });
    await settle();
    const before = await count(`select count(*) as n from ${T.blobs}`);
    expect(before).toBeGreaterThanOrEqual(3);
    const out = await dbTransaction((client) => eraseDocumentsForApplications(client, [w.appLbd], 'ลบข้อมูลแล้ว'));
    expect(out.documentPackets).toBe(1);
    expect(await count(`select count(*) as n from ${T.blobs} b join ${T.files} f on f.id = b.file_id where f.application_id = $1`, [w.appLbd])).toBe(0);
    const { rows } = await dbQuery<{ erased_at: Date | null; payload_enc: string; line_user_id: string; person_name: string }>(
      `select erased_at, payload_enc, line_user_id, person_name from ${T.packets} where id = $1`,
      [s.packetId],
    );
    expect(rows[0]).toMatchObject({ payload_enc: '', line_user_id: '', person_name: 'ลบข้อมูลแล้ว' });
    expect(rows[0].erased_at).not.toBeNull();
    const r = await detail(w.staffLbd, w.appLbd, s.packetId);
    expect(r.status).toBe(200);
    expect(r.json.packet.erased).toBe(true);
    expect(r.json.packet.person).toEqual([]);
    // ชื่อ LINE "Ty" ต้องไม่เหลือเป็นค่าในช่องไหนเลย (คำว่า actorType เป็นชื่อช่อง ไม่นับ)
    expect(JSON.stringify(r.json)).not.toContain('"Ty"');
    expect(r.json.events.filter((e: Json) => e.actorType === 'applicant').every((e: Json) => e.actorName === null)).toBe(true);
    const pdf = await call(packetsHandler, { cookie: w.staffLbd.cookie, query: { pdf: 'background', packetId: s.packetId } });
    expect(pdf.status).toBe(410);
    const box = await inbox(w.staffLbd);
    expect(JSON.stringify(box.json.items)).not.toContain('สมมติ ทดลองระบบ ส่งเอกสารแล้ว');
    expect(JSON.stringify(box.json.items)).toContain('มีผู้สมัครส่งเอกสารแล้ว');
    // คุกกี้ของผู้สมัครใช้ต่อไม่ได้ · ชุดเดิมแก้ไม่ได้นอกจากตอนล้าง (ล้างซ้ำไม่เปลี่ยนอะไร)
    const state = await call(publicHandler, { cookie: s.opened.cookie, query: { action: 'state', k: s.opened.k } });
    expect(state.status).toBe(401);
    const again = await dbTransaction((client) => eraseDocumentsForApplications(client, [w.appLbd], 'ลบข้อมูลแล้ว'));
    expect(again.documentPackets).toBe(0);
    await expect(dbQuery(`update ${T.packets} set person_name = 'แก้' where id = $1`, [s.packetId])).rejects.toThrow(/แก้ไม่ได้/);
  });
});

afterAll(async () => {
  if (!HAS_DB) return;
  const { dbQuery: q } = await import('../../../api/_lib/postgres');
  await q('select 1');
});
