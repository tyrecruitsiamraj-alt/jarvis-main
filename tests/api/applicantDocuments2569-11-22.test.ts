// @vitest-environment node
/**
 * ส่งเอกสารผ่าน LINE (เจ้าของ 22 พ.ย. 2569) — ส่วนที่ไม่ต้องมีฐานข้อมูล:
 * ยืนยันบัญชี LINE · เข้ารหัส · ลายเซ็น · PDF · สิทธิ์และการลงทะเบียนเส้น
 * (เส้นทางเต็มกับฐานจริงอยู่ที่ tests/integration/documents · รันด้วย npm run test:documents)
 */
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { DocError, DocumentKeyError, decryptBytes, decryptText, encryptBytes, encryptText, inviteKeyOf, isLineMockAllowed, newToken, sha256Hex, TOKEN_RE } from '../../api/_lib/documents/core';
import { safeLinePicture, verifyLineIdToken } from '../../api/_lib/documents/line';
import { checkDrawnSignature } from '../../api/_lib/documents/signature';
import { buildPacketPdf, wrapThai } from '../../api/_lib/documents/pdf';
import { outboxBackoffSeconds } from '../../api/_lib/documents/outbox';
import { checkApiAccess, minimumRoleFor } from '../../api/_lib/rbac';
import { resolveCall } from '../../api/_lib/aiAssistant/tools';
import { apiRoutes } from '../../api/_handlers/registry';
import type { StoredPayload } from '../../api/_lib/documents/applicant';

const SECRET = 'unit-test-secret-0123456789-abcdefghij';
const setSecret = (v: string | undefined) => {
  if (v === undefined) delete process.env.AUTH_JWT_SECRET;
  else process.env.AUTH_JWT_SECRET = v;
};

function png(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): Buffer {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = table[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * (width * 4 + 1) + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const dataUrl = (b: Buffer) => `data:image/png;base64,${b.toString('base64')}`;
const stroke = png(320, 110, (x, y) => (Math.abs(y - (20 + Math.round((x / 320) * 70))) <= 1 && x > 20 && x < 300 ? [48, 51, 59, 255] : [0, 0, 0, 0]));

describe('ยืนยันบัญชี LINE ที่เซิร์ฟเวอร์', () => {
  const CHANNEL = '2012712816';
  const valid = { iss: 'https://access.line.me', aud: CHANNEL, sub: `U${'a'.repeat(32)}`, exp: Math.floor(Date.now() / 1000) + 300, name: 'ชื่อ LINE ทดสอบ', picture: 'https://profile.line-scdn.net/example' };
  const token = 'x'.repeat(60);
  const lineReplies = (claims: unknown, status = 200) =>
    (async (url: string, options: RequestInit) => {
      expect(url).toBe('https://api.line.me/oauth2/v2.1/verify');
      expect(options.method).toBe('POST');
      expect((options.body as URLSearchParams).get('client_id')).toBe(CHANNEL);
      expect((options.body as URLSearchParams).get('id_token')).toBe(token);
      return new Response(JSON.stringify(claims), { status });
    }) as unknown as typeof fetch;

  it('รับชื่อ/รูป/รหัสบัญชีจากผลที่ LINE ตรวจเท่านั้น และไม่เก็บโทเคน', async () => {
    const p = await verifyLineIdToken(token, CHANNEL, lineReplies(valid));
    expect(p).toMatchObject({ userId: valid.sub, displayName: valid.name, pictureUrl: valid.picture, channelId: CHANNEL });
    expect(JSON.stringify(p)).not.toContain(token);
  });

  it.each([
    ['ผิดช่อง (aud)', { ...valid, aud: '999' }],
    ['หมดอายุ', { ...valid, exp: 1 }],
    ['ผิดผู้ออก (iss)', { ...valid, iss: 'https://attacker.example' }],
    ['รหัสบัญชีผิดรูป', { ...valid, sub: 'display-name' }],
    ['ไม่มีชื่อ', { ...valid, name: undefined }],
  ])('ไม่รับ: %s', async (_name, claims) => {
    await expect(verifyLineIdToken(token, CHANNEL, lineReplies(claims))).rejects.toMatchObject({ code: 'invalid_line_claims', status: 401 });
  });

  it('โทเคนผิดรูปไม่ถูกส่งไปถาม LINE · LINE ปฏิเสธ = ไม่ผ่าน · LINE ล่ม = บอกให้ลองใหม่', async () => {
    const never = (() => {
      throw new Error('ห้ามเรียก');
    }) as unknown as typeof fetch;
    await expect(verifyLineIdToken('bad', CHANNEL, never)).rejects.toMatchObject({ code: 'invalid_token' });
    await expect(verifyLineIdToken({ token }, CHANNEL, never)).rejects.toMatchObject({ code: 'invalid_token' });
    await expect(verifyLineIdToken(token, CHANNEL, lineReplies({}, 401))).rejects.toMatchObject({ code: 'line_verification_failed', status: 401 });
    await expect(verifyLineIdToken(token, CHANNEL, lineReplies({}, 429))).rejects.toMatchObject({ status: 429 });
    await expect(verifyLineIdToken(token, CHANNEL, (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch)).rejects.toMatchObject({ code: 'line_unreachable', status: 503 });
    await expect(verifyLineIdToken(token, '', never)).rejects.toMatchObject({ code: 'line_not_configured' });
  });

  it('รูปโปรไฟล์: https ของ LINE เท่านั้น ที่เหลือ = ไม่มีรูป', () => {
    expect(safeLinePicture('https://profile.line-scdn.net/abc')).toBe('https://profile.line-scdn.net/abc');
    for (const bad of ['javascript:alert(1)', 'http://profile.line-scdn.net/x', 'https://attacker.example/face.jpg', 'https://line-scdn.net.attacker.example/x', '', null, 5]) {
      expect(safeLinePicture(bad)).toBeNull();
    }
  });

  describe('บัญชีจำลองของเครื่องทดสอบ', () => {
    const env = { ...process.env };
    afterEach(() => {
      process.env.NODE_ENV = env.NODE_ENV;
      process.env.VERCEL_ENV = env.VERCEL_ENV;
      if (env.DOCUMENTS_LINE_MOCK === undefined) delete process.env.DOCUMENTS_LINE_MOCK;
      else process.env.DOCUMENTS_LINE_MOCK = env.DOCUMENTS_LINE_MOCK;
    });
    const mockToken = `mock.${Buffer.from(JSON.stringify({ sub: `U${'b'.repeat(32)}`, name: 'จำลอง' })).toString('base64url')}`;
    const never = (() => {
      throw new Error('ห้ามเรียก LINE');
    }) as unknown as typeof fetch;

    it('ใช้ได้เมื่อไม่ใช่ production และเปิด DOCUMENTS_LINE_MOCK=1 เท่านั้น', async () => {
      process.env.NODE_ENV = 'test';
      process.env.DOCUMENTS_LINE_MOCK = '1';
      expect(isLineMockAllowed()).toBe(true);
      await expect(verifyLineIdToken(mockToken, '', never)).resolves.toMatchObject({ displayName: 'จำลอง' });
      delete process.env.DOCUMENTS_LINE_MOCK;
      expect(isLineMockAllowed()).toBe(false);
      await expect(verifyLineIdToken(mockToken, CHANNEL, never)).rejects.toBeInstanceOf(DocError);
    });

    it('🔴 production ปิดเสมอ แม้ตั้งค่านี้ไว้', async () => {
      process.env.DOCUMENTS_LINE_MOCK = '1';
      process.env.NODE_ENV = 'production';
      expect(isLineMockAllowed()).toBe(false);
      await expect(verifyLineIdToken(mockToken, CHANNEL, never)).rejects.toMatchObject({ code: 'line_verification_failed' });
      process.env.NODE_ENV = 'test';
      process.env.VERCEL_ENV = 'production';
      expect(isLineMockAllowed()).toBe(false);
    });
  });
});

describe('รหัสลิงก์และการเข้ารหัส', () => {
  const saved = { secret: process.env.AUTH_JWT_SECRET, fallback: process.env.DOCUMENT_KEY_FALLBACK_SECRETS };
  afterEach(() => {
    setSecret(saved.secret);
    if (saved.fallback === undefined) delete process.env.DOCUMENT_KEY_FALLBACK_SECRETS;
    else process.env.DOCUMENT_KEY_FALLBACK_SECRETS = saved.fallback;
  });

  it('รหัสลิงก์สุ่ม 32 ไบต์ ไม่ซ้ำ · ฐานเก็บแฮช · คีย์สั้นเดาย้อนไม่ได้', () => {
    const a = newToken();
    const b = newToken();
    expect(a).toMatch(TOKEN_RE);
    expect(a).not.toBe(b);
    expect(sha256Hex(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256Hex(a)).not.toBe(a);
    expect(inviteKeyOf(sha256Hex(a))).toHaveLength(16);
    expect(a).not.toContain(inviteKeyOf(sha256Hex(a)));
  });

  it('เข้ารหัสแล้วอ่านไม่ออก ถอดกลับได้เท่าเดิม · สองครั้งไม่ได้ผลซ้ำกัน', () => {
    setSecret(SECRET);
    const plain = Buffer.from('เลขบัตร 0000012345679 ที่อยู่ 99/1');
    const one = encryptBytes(plain);
    const two = encryptBytes(plain);
    expect(one.bytes.includes(plain)).toBe(false);
    expect(one.bytes.equals(two.bytes)).toBe(false);
    expect(decryptBytes(one.bytes, one.keyId).equals(plain)).toBe(true);
    const t = encryptText('ข้อความ');
    expect(decryptText(t.text, t.keyId)).toBe('ข้อความ');
  });

  it('ข้อมูลถูกแก้ = ถอดไม่ได้ (ไม่คืนข้อมูลเพี้ยน)', () => {
    setSecret(SECRET);
    const enc = encryptBytes(Buffer.from('ต้นฉบับ'));
    const tampered = Buffer.from(enc.bytes);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decryptBytes(tampered, enc.keyId)).toThrow(DocumentKeyError);
    expect(() => decryptBytes(Buffer.from([1, 2, 3]), enc.keyId)).toThrow(DocumentKeyError);
  });

  it('กุญแจของเซิร์ฟเวอร์เปลี่ยน: บอกชัดว่ากุญแจไม่ตรง · ใส่ค่าเดิมเป็นกุญแจสำรองแล้วเปิดของเก่าได้', () => {
    setSecret(SECRET);
    const enc = encryptBytes(Buffer.from('เอกสารเก่า'));
    setSecret('another-secret-9876543210-zyxwvutsrq');
    expect(() => decryptBytes(enc.bytes, enc.keyId)).toThrow(/กุญแจ/);
    process.env.DOCUMENT_KEY_FALLBACK_SECRETS = `x-unused, ${SECRET}`;
    expect(decryptBytes(enc.bytes, enc.keyId).toString()).toBe('เอกสารเก่า');
    // ของใหม่ใช้กุญแจปัจจุบัน
    expect(encryptBytes(Buffer.from('ใหม่')).keyId).not.toBe(enc.keyId);
    setSecret(undefined);
    expect(() => encryptBytes(Buffer.from('x'))).toThrow(DocumentKeyError);
  });
});

describe('ลายเซ็นที่เขียนบนจอ', () => {
  it('เส้นลายเซ็นจริงผ่าน และได้แฮชของภาพ', () => {
    const r = checkDrawnSignature(dataUrl(stroke));
    expect(r.sha256).toBe(sha256Hex(stroke));
    expect(r.inkPixels).toBeGreaterThan(150);
  });
  it.each([
    ['โปร่งใสทั้งภาพ', png(320, 110, () => [0, 0, 0, 0])],
    ['พื้นขาวทึบ ไม่มีเส้น', png(320, 110, () => [255, 255, 255, 255])],
    ['จุดเดียว', png(320, 110, (x, y) => (x > 100 && x < 104 && y > 50 && y < 54 ? [0, 0, 0, 255] : [0, 0, 0, 0]))],
    ['ขีดสั้นมาก', png(320, 110, (x, y) => (y === 50 && x > 100 && x < 130 ? [0, 0, 0, 255] : [0, 0, 0, 0]))],
    ['ทาทึบทั้งแผ่น', png(320, 110, () => [20, 20, 20, 255])],
    ['ภาพเล็กเกิน', png(40, 20, () => [0, 0, 0, 255])],
  ])('ไม่รับ: %s', (_name, img) => {
    expect(() => checkDrawnSignature(dataUrl(img))).toThrow(DocError);
  });
  it('ไม่ใช่ PNG จริง = ไม่รับ', () => {
    expect(() => checkDrawnSignature(`data:image/png;base64,${Buffer.from('<svg onload=alert(1)>'.repeat(20)).toString('base64')}`)).toThrow(DocError);
    expect(() => checkDrawnSignature('data:image/png;base64,')).toThrow(DocError);
  });
});

describe('PDF ของเอกสารในชุด', () => {
  const payload = {
    version: 'v',
    noticeVersion: 'n',
    person: {
      prefix: 'นาย', firstName: 'ทดลอง', lastName: 'อ่านเอกสาร', dob: '1995-01-15', nationalId: '0000012345679', phone: '0800000000',
      address: '99/1 แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200', currentAddress: '99/1 แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200',
      licenseNumber: '65001234', licenseLifetime: true,
    },
    addresses: { registered: {}, current: {}, sameAsRegistered: true },
    consents: { background: 'yes', payroll: 'discuss', privacy: 'no', ex: 'yes', reputation: 'yes' },
    templates: {},
    signature: { method: 'drawn', name: 'ทดลอง อ่านเอกสาร', image: dataUrl(stroke) },
    attachments: [],
    ocr: {},
    senderRelation: 'self',
    files: [],
    attention: [],
    line: { userId: `U${'c'.repeat(32)}`, displayName: 'Ty', pictureUrl: null, verifiedAt: '2026-11-22T03:00:00.000Z', senderRelation: 'self' },
  } as unknown as StoredPayload;
  const page = png(300, 424, (x, y) => ((x + y) % 31 === 0 ? [60, 60, 90, 255] : [255, 255, 255, 255]));
  const build = (docId: 'ex' | 'privacy', pages: number, over: Partial<StoredPayload> = {}) =>
    buildPacketPdf({
      packetId: '00000000-0000-0000-0000-000000000001',
      docId,
      submittedAt: new Date('2026-11-22T03:15:07.000Z'),
      formVersion: 'jarvis-documents-test',
      payloadHash: 'a'.repeat(64),
      template: { version: 3, sha256: 'b'.repeat(64), pages: Array.from({ length: pages }, () => ({ mime: 'image/png', bytes: page })) },
      payload: { ...payload, ...over } as StoredPayload,
      jobLabel: 'หน่วยงานทดสอบ · พนักงานขับรถ',
    });

  it('ต้นฉบับครบทุกหน้า + หน้าแนบท้าย · เวลาในไฟล์ = เวลาที่ส่ง · สร้างซ้ำได้ไฟล์เดิมทุกไบต์', async () => {
    const a = await build('ex', 3);
    const b = await build('ex', 3);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    // updateMetadata: false — อ่านค่าที่เราเขียนไว้ ไม่ให้ตัวโหลดเขียนชื่อโปรแกรม/เวลาแก้ไขทับ
    const pdf = await PDFDocument.load(a, { updateMetadata: false });
    expect(pdf.getPageCount()).toBe(4);
    expect(pdf.getModificationDate()?.toISOString()).toBe('2026-11-22T03:15:07.000Z');
    expect(pdf.getTitle()).toBe('สัญญาจ้าง EX - ทดลอง อ่านเอกสาร');
    expect(pdf.getCreationDate()?.toISOString()).toBe('2026-11-22T03:15:07.000Z');
    expect(pdf.getProducer()).toBe('So Recruit');
    expect((await PDFDocument.load(await build('privacy', 1))).getPageCount()).toBe(2);
  });

  it('ลงนามแบบพิมพ์ชื่อก็สร้างได้ · คำตอบต่างกันได้ไฟล์ต่างกัน', async () => {
    const typed = await build('privacy', 1, { signature: { method: 'typed', name: 'ทดลอง อ่านเอกสาร', image: '' } });
    expect((await PDFDocument.load(typed)).getPageCount()).toBe(2);
    const yes = await build('privacy', 1, { consents: { ...payload.consents, privacy: 'yes' } });
    expect(Buffer.from(yes).equals(Buffer.from(await build('privacy', 1)))).toBe(false);
  });

  it('ตัดบรรทัดไทยตามคำ ไม่เกินความกว้าง และข้อความไม่หาย', async () => {
    const pdf = await PDFDocument.create();
    const fontkit = (await import('@pdf-lib/fontkit')).default;
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(readFileSync('api/_assets/fonts/Kanit-Regular.ttf'), { subset: true });
    const text = 'ข้าพเจ้ายินยอมให้บริษัทตรวจสอบประวัติของข้าพเจ้ากับกองทะเบียนประวัติอาชญากรโดยไม่มีเงื่อนไขใดๆทั้งสิ้น และรับทราบข้อตกลงรักษาภาพลักษณ์';
    const lines = wrapThai(text, font, 12, 200);
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 12)).toBeLessThanOrEqual(200);
    expect(lines.join('').replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
    // แฮชยาวไม่มีช่องว่าง — ตัดได้ ไม่ล้นหน้า
    const hash = wrapThai('a'.repeat(200), font, 9, 150);
    expect(hash.length).toBeGreaterThan(1);
    expect(hash.join('')).toBe('a'.repeat(200));
  });
});

describe('คิวแจ้งเตือน', () => {
  it('เว้นช่วงลองใหม่ยาวขึ้นเรื่อย ๆ สูงสุด 30 นาที', () => {
    expect([1, 2, 3, 4, 8, 20].map(outboxBackoffSeconds)).toEqual([15, 30, 60, 120, 1800, 1800]);
  });
});

describe('สิทธิ์และการลงทะเบียนเส้น', () => {
  it('ลงทะเบียนครบ 4 เส้น', () => {
    for (const path of ['/api/document-invitations', '/api/document-packets', '/api/document-settings', '/api/public/applicant-documents']) {
      expect(typeof (apiRoutes as Record<string, unknown>)[path]).toBe('function');
    }
  });
  it('ตั้งค่า: อ่านได้ทุกคน แก้ได้เฉพาะ admin · คนอ่านอย่างเดียวสร้างลิงก์/ทำอะไรกับชุดไม่ได้', () => {
    expect(minimumRoleFor('document-settings', 'GET')).toBe('staff');
    for (const m of ['PUT', 'POST', 'DELETE']) expect(minimumRoleFor('document-settings', m)).toBe('admin');
    expect(checkApiAccess('opl', 'job-applications', 'POST').ok).toBe(false);
    expect(checkApiAccess('sale', 'job-applications', 'POST').ok).toBe(false);
    expect(checkApiAccess('staff', 'job-applications', 'POST').ok).toBe(true);
  });
  it('ผู้ช่วย AI เรียกเส้นเอกสารไม่ได้ ทั้งอ่านและเขียน (ข้อมูลบัตรไม่ออกไปนอกระบบ)', () => {
    for (const path of ['/api/document-packets', '/api/document-packets?applicationId=x', '/api/document-invitations', '/api/document-settings', '/api/public/applicant-documents?action=config']) {
      for (const method of ['GET', 'POST']) expect(resolveCall(method, path).ok).toBe(false);
    }
  });
  it('หน้าของผู้สมัคร: คุกกี้ HttpOnly จำกัดเส้นทาง · ไม่พิมพ์รหัสลิงก์/โทเคนลง log', () => {
    const src = readFileSync('api/_lib/documents/applicant.ts', 'utf8');
    expect(src).toContain('HttpOnly;');
    expect(src).toContain("SameSite=Lax");
    expect(src).toContain("SESSION_COOKIE_PATH = '/api/public/applicant-documents'");
    for (const file of ['api/_lib/documents/applicant.ts', 'api/_lib/documents/line.ts', 'api/_lib/documents/staff.ts', 'api/_handlers/public/applicant-documents.ts', 'api/_handlers/document-invitations.ts']) {
      const code = readFileSync(file, 'utf8');
      expect(code).not.toMatch(/log(Info|Warn|Error)\([^)]*(idToken|rawToken|rawSession|invitation\b|\braw\b)/);
    }
  });
  it('ไม่มีการส่งข้อความ LINE / Messaging API ในงานนี้', () => {
    for (const file of ['api/_lib/documents/applicant.ts', 'api/_lib/documents/staff.ts', 'api/_lib/documents/line.ts', 'api/_lib/documents/outbox.ts']) {
      const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/api\.line\.me\/v2\/bot|message\/push|channel[_ ]?access[_ ]?token/i);
    }
    vi.restoreAllMocks();
  });
});
