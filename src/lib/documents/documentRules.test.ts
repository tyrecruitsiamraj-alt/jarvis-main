/**
 * สถานะงานเอกสาร · แจ้งเตือน + ลิงก์เปิดชุด · ตรวจภาพที่แนบ (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 */
import { describe, expect, it } from 'vitest';
import { DOC_IDS, DOC_TYPES, IRECRUIT_DIVISIONS, UPLOAD_KINDS, answerLabel, attentionText } from './documentTypes';
import { DOCUMENT_STATUS_LABEL, documentStatusOf, invitationStateLabel, type StatusLink, type StatusPacket } from './documentStatus';
import { DOCUMENT_PACKET_NOTIFICATION_TYPE, documentsDeepLink, parseDocumentsDeepLink, planDocumentPacketNotification } from './documentNotification';
import { checkUploadBytes, imageMime, imageSize, validateUploadList } from './uploadValidation';
import { DOCUMENT_NOTIFICATION_TYPE, KEEP_UNREAD_NOTIFICATION_TYPES, PINNED_NOTIFICATION_TYPES, capKeepingPinned, notificationsOfTab } from '../notificationTabs';

const NOW = Date.parse('2026-11-22T05:00:00Z');
const link = (over: Partial<StatusLink> = {}): StatusLink => ({ id: 'L1', createdAt: '2026-11-22T01:00:00Z', expiresAt: '2026-11-23T01:00:00Z', revokedAt: null, firstOpenedAt: null, ...over });
const packet = (over: Partial<StatusPacket> = {}): StatusPacket => ({ invitationId: 'L1', submittedAt: '2026-11-22T02:00:00Z', attentionCount: 0, attentionAcked: false, reviewFlag: false, imported: false, ...over });

describe('เอกสาร 5 ประเภท', () => {
  it('ครบ 5 ประเภทตามที่ตกลง · EX มีคำตอบเดียว · ไม่มีคำตอบที่ถูกเลือกไว้ก่อน', () => {
    expect([...DOC_IDS]).toEqual(['background', 'payroll', 'privacy', 'ex', 'reputation']);
    expect(DOC_TYPES.map((d) => d.title)).toEqual([
      'หนังสือยินยอมให้ตรวจประวัติ',
      'รับทราบการใช้แอป Tik Tack',
      'ความยินยอมใช้ข้อมูลส่วนบุคคล',
      'สัญญาจ้าง EX',
      'ข้อตกลงรักษาภาพลักษณ์และความลับ',
    ]);
    expect(DOC_TYPES.find((d) => d.id === 'ex')?.answers.map((a) => a.value)).toEqual(['yes']);
    expect(DOC_TYPES.every((d) => d.answers.every((a) => !('default' in a)))).toBe(true);
    expect(answerLabel('privacy', 'no')).toBe('ไม่ให้ความยินยอม');
    expect(answerLabel('privacy', undefined)).toBe('ยังไม่มีคำตอบ');
    expect([...UPLOAD_KINDS]).toEqual(['id', 'license', 'house']);
    expect(attentionText({ code: 'consent_discuss', doc: 'payroll' })).toBe('รับทราบการใช้แอป Tik Tack: ขอให้เจ้าหน้าที่อธิบาย');
    expect(IRECRUIT_DIVISIONS).toContain('LB');
  });
});

describe('สถานะงานเอกสาร — เปิด ≠ ส่ง ≠ นำเข้า', () => {
  it('ลิงก์อย่างเดียว', () => {
    expect(documentStatusOf(link(), null, NOW)).toBe('not_opened');
    expect(documentStatusOf(link({ firstOpenedAt: '2026-11-22T03:00:00Z' }), null, NOW)).toBe('opened');
    expect(documentStatusOf(link({ expiresAt: '2026-11-22T04:00:00Z' }), null, NOW)).toBe('link_expired');
    expect(documentStatusOf(link({ expiresAt: '2026-11-22T04:00:00Z', firstOpenedAt: '2026-11-22T03:00:00Z' }), null, NOW)).toBe('link_expired');
    expect(documentStatusOf(link({ revokedAt: '2026-11-22T03:00:00Z' }), null, NOW)).toBe('link_revoked');
  });
  it('ส่งแล้ว: ครบ = พร้อมนำเข้า · มีเรื่อง/ติดธง = ต้องแก้ · รับทราบแล้ว = พร้อม · นำเข้าแล้วมาก่อนทุกอย่าง', () => {
    expect(documentStatusOf(link({ firstOpenedAt: 'x' }), packet(), NOW)).toBe('ready');
    expect(documentStatusOf(link(), packet({ attentionCount: 2 }), NOW)).toBe('needs_fix');
    expect(documentStatusOf(link(), packet({ attentionCount: 2, attentionAcked: true }), NOW)).toBe('ready');
    expect(documentStatusOf(link(), packet({ reviewFlag: true, attentionAcked: true }), NOW)).toBe('needs_fix');
    expect(documentStatusOf(link(), packet({ imported: true, reviewFlag: true }), NOW)).toBe('imported');
    // ลิงก์ที่ส่งแล้วหมดอายุทีหลัง ไม่ทำให้สถานะชุดเปลี่ยน
    expect(documentStatusOf(link({ expiresAt: '2026-11-22T04:00:00Z' }), packet(), NOW)).toBe('ready');
  });
  it('ลิงก์ใหม่ที่ออกหลังชุดล่าสุดและยังใช้ได้ = รอบใหม่ · ลิงก์ใหม่ที่ตายแล้วไม่บังชุดเดิม', () => {
    const newer = { id: 'L2', createdAt: '2026-11-22T03:00:00Z' };
    expect(documentStatusOf(link(newer), packet(), NOW)).toBe('not_opened');
    expect(documentStatusOf(link({ ...newer, firstOpenedAt: '2026-11-22T04:00:00Z' }), packet({ attentionCount: 1 }), NOW)).toBe('opened');
    expect(documentStatusOf(link({ ...newer, revokedAt: '2026-11-22T04:00:00Z' }), packet(), NOW)).toBe('ready');
    expect(documentStatusOf(link({ ...newer, expiresAt: '2026-11-22T04:30:00Z' }), packet({ attentionCount: 1 }), NOW)).toBe('needs_fix');
  });
  it('คำบนจอของสถานะ', () => {
    expect(DOCUMENT_STATUS_LABEL).toMatchObject({
      not_opened: 'ยังไม่มีผู้เปิดลิงก์นี้',
      opened: 'เปิดลิงก์แล้ว ยังไม่ส่งเอกสาร',
      needs_fix: 'มีข้อมูลต้องแก้ไข',
      ready: 'พร้อมนำเข้า iRecruit',
      imported: 'นำเข้าแล้ว',
    });
    expect(invitationStateLabel({ ...link(), submittedAt: '2026-11-22T02:00:00Z' }, NOW)).toBe('ส่งเอกสารแล้ว');
    expect(invitationStateLabel(link({ firstOpenedAt: 'x' }), NOW)).toBe('เปิดลิงก์แล้ว ยังไม่ส่งเอกสาร');
  });
});

describe('แจ้งเตือนเมื่อส่งเอกสารสำเร็จ', () => {
  const event = {
    committed: true,
    packetId: '00000000-0000-0000-0000-000000000001',
    applicationId: '00000000-0000-0000-0000-000000000002',
    createdByUserId: '00000000-0000-0000-0000-000000000003',
    applicantName: 'ผู้สมัคร ทดสอบ',
    requestLabel: 'ใบขอทดสอบ A',
  };
  it('แนบร่าง/ยังไม่บันทึกชุด = ไม่แจ้ง', () => {
    expect(planDocumentPacketNotification({ ...event, committed: false })).toBeNull();
  });
  it('ผู้รับ = คนสร้างลิงก์ที่เซิร์ฟเวอร์จดไว้ · ไม่มี/ผิดรูป = ไม่มีผู้รับ (ไม่ตกไปแจ้งทุกคน)', () => {
    expect(planDocumentPacketNotification(event)?.recipientUserId).toBe(event.createdByUserId);
    expect(planDocumentPacketNotification({ ...event, createdByUserId: '' })?.recipientUserId).toBeNull();
    expect(planDocumentPacketNotification({ ...event, createdByUserId: 'everyone' })?.recipientUserId).toBeNull();
  });
  it('ส่งซ้ำ/ลองใหม่ใช้คีย์กันซ้ำเดิม · ชุดใหม่ได้คีย์ใหม่', () => {
    const a = planDocumentPacketNotification(event)!;
    expect(planDocumentPacketNotification({ ...event })!.dedupeKey).toBe(a.dedupeKey);
    expect(a.dedupeKey).toBe(`document_packet_submitted:${event.packetId}`);
    expect(planDocumentPacketNotification({ ...event, packetId: '00000000-0000-0000-0000-000000000004' })!.dedupeKey).not.toBe(a.dedupeKey);
  });
  it('ลิงก์ชี้ใบสมัคร + ชุดนั้นพอดี ไม่มีรหัสลิงก์ของผู้สมัคร', () => {
    const u = new URL(planDocumentPacketNotification(event)!.link, 'https://jarvis.test');
    // 23 พ.ย. 2569 หน้าเอกสารย้ายเป็นเมนู /documents (ลิงก์เก่า /jobs/board?view=documents ยังพามาที่นี่)
    expect(u.pathname).toBe('/documents');
    expect(Object.fromEntries(u.searchParams)).toEqual({ applicationId: event.applicationId, packetId: event.packetId });
    expect(parseDocumentsDeepLink(u.search)).toEqual({ applicationId: event.applicationId, packetId: event.packetId });
    expect(documentsDeepLink(event.applicationId)).toBe(`/documents?applicationId=${event.applicationId}`);
  });
  it('รหัสผิดรูปเอาไปทำลิงก์ไม่ได้ และอ่านจาก URL ก็ไม่รับ', () => {
    expect(() => planDocumentPacketNotification({ ...event, applicationId: 'https://evil.test' })).toThrow();
    expect(() => planDocumentPacketNotification({ ...event, packetId: '../other' })).toThrow();
    expect(parseDocumentsDeepLink('?view=documents&applicationId=../x&packetId=1')).toEqual({ applicationId: null, packetId: null });
  });
  it('ข้อความบอกแค่ใครส่ง ใบขอไหน ไม่มีเนื้อหาเอกสาร', () => {
    const n = planDocumentPacketNotification(event)!;
    expect(n.title).toBe('ผู้สมัคร ทดสอบ ส่งเอกสารแล้ว');
    expect(n.body).toBe('ใบขอทดสอบ A');
    expect(Object.keys(n).sort()).toEqual(['body', 'dedupeKey', 'link', 'recipientUserId', 'title', 'type']);
    expect(planDocumentPacketNotification({ ...event, applicantName: ' ', requestLabel: '' })).toMatchObject({ title: 'มีผู้สมัครส่งเอกสารแล้ว', body: 'กดเพื่อเปิดชุดเอกสารที่ส่ง' });
  });
  it('ชนิดแจ้งเตือนเดียวกันทั้งฝั่งส่งและกระดิ่ง · ปักไว้ไม่ให้ตก · ยังไม่อ่านอยู่ครบ · มีแท็บของตัวเอง', () => {
    expect(DOCUMENT_NOTIFICATION_TYPE).toBe(DOCUMENT_PACKET_NOTIFICATION_TYPE);
    expect(PINNED_NOTIFICATION_TYPES).toContain(DOCUMENT_NOTIFICATION_TYPE);
    expect(KEEP_UNREAD_NOTIFICATION_TYPES).toContain(DOCUMENT_NOTIFICATION_TYPE);
    const many = [
      { type: DOCUMENT_NOTIFICATION_TYPE, timestamp: '2026-10-01T00:00:00Z' },
      ...Array.from({ length: 80 }, (_, i) => ({ type: 'needs_human', timestamp: `2026-11-22T00:${String(i % 60).padStart(2, '0')}:00Z` })),
    ];
    const kept = capKeepingPinned(many, 30);
    expect(kept.filter((n) => n.type === DOCUMENT_NOTIFICATION_TYPE)).toHaveLength(1);
    expect(kept).toHaveLength(31);
    expect(notificationsOfTab(many, 'docs')).toHaveLength(1);
    expect(notificationsOfTab(many, 'so')).toHaveLength(0);
    expect(notificationsOfTab(many, 'all')).toHaveLength(81);
  });
});

describe('ตรวจภาพที่แนบจากไบต์จริง', () => {
  const jpegHead = (w: number, h: number) =>
    new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  it('ดูชนิดจากไบต์ ไม่เชื่อนามสกุล', () => {
    expect(imageMime(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>bad</script></svg>'))).toBeNull();
    expect(imageMime(new TextEncoder().encode('<!doctype html><html></html>'))).toBeNull();
    expect(imageMime(new TextEncoder().encode('%PDF-1.7 ..........'))).toBeNull();
    expect(imageMime(jpegHead(800, 600))).toBe('image/jpeg');
    expect(imageMime(new Uint8Array([255, 216, 255]))).toBeNull();
  });
  it('อ่านขนาดภาพจากหัวไฟล์', () => {
    expect(imageSize(jpegHead(1280, 800))).toEqual({ width: 1280, height: 800 });
    const png = new Uint8Array(33);
    png.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 2, 128, 0, 0, 1, 144]);
    expect(imageSize(png)).toEqual({ width: 640, height: 400 });
  });
  it('เล็กไป / ใหญ่ไป / ไม่ใช่ภาพ = ไม่รับ พร้อมข้อความบอกวิธีแก้', () => {
    const pad = (head: Uint8Array, size: number) => {
      const b = new Uint8Array(size);
      b.set(head);
      return b;
    };
    expect(checkUploadBytes(pad(jpegHead(1280, 800), 50_000))).toEqual({ ok: true, mime: 'image/jpeg', width: 1280, height: 800 });
    // ถ่ายแนวตั้งก็ได้
    expect(checkUploadBytes(pad(jpegHead(800, 1280), 50_000))).toMatchObject({ ok: true });
    expect(checkUploadBytes(pad(jpegHead(300, 200), 50_000))).toMatchObject({ ok: false, status: 400 });
    expect(checkUploadBytes(pad(jpegHead(9000, 800), 50_000))).toMatchObject({ ok: false, status: 413 });
    expect(checkUploadBytes(pad(jpegHead(1280, 800), 4_000_001))).toMatchObject({ ok: false, status: 413 });
    expect(checkUploadBytes(pad(jpegHead(1280, 800), 100))).toMatchObject({ ok: false, status: 400 });
    expect(checkUploadBytes(pad(new TextEncoder().encode('<svg>'), 50_000))).toMatchObject({ ok: false, status: 415 });
  });
  it('รายการไฟล์ของชุด: ครบ 3 ประเภท คนละไฟล์', () => {
    expect(() => validateUploadList([{ id: '00000000-0000-0000-0000-000000000001', kind: 'id' }])).toThrow();
    const list = ['id', 'license', 'house'].map((kind, i) => ({ id: `00000000-0000-0000-0000-00000000000${i + 1}`, kind }));
    expect(validateUploadList(list)).toHaveLength(3);
    expect(() => validateUploadList([...list.slice(0, 2), { id: list[0].id, kind: 'house' }])).toThrow(/คนละไฟล์/);
    expect(() => validateUploadList([...list.slice(0, 2), { id: list[2].id, kind: 'id_back' }])).toThrow();
  });
});
