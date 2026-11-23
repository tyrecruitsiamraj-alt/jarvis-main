/**
 * เครื่องมือของเทสต์ส่งเอกสารผ่าน LINE — ยิง handler จริงกับ Postgres ทิ้งได้ในเครื่อง ด้วยข้อมูลจำลองทั้งหมด
 *
 * 🔴 กันพลาด: ต้องตั้ง DOCS_TEST_DATABASE_URL เอง และต้องชี้ localhost/127.0.0.1 เท่านั้น (เทสต์ล้างตาราง) —
 *    ไม่อ่าน .env ของโปรเจกต์ ไม่มีทางไปถึงฐานจริง
 * ไม่มีชื่อ/เบอร์/เลขบัตรของคนจริง · บัญชี LINE เป็นของจำลอง (DOCUMENTS_LINE_MOCK) · ไม่เรียก LINE / iRecruit / ERP จริง
 */
import { deflateSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';

const url = (process.env.DOCS_TEST_DATABASE_URL || '').trim();
export const HAS_DB = url !== '';
if (HAS_DB) {
  const u = new URL(url);
  if (!['127.0.0.1', 'localhost'].includes(u.hostname) || !/(_docs|_test)$/.test(u.pathname)) {
    throw new Error('DOCS_TEST_DATABASE_URL ต้องเป็นฐานทดสอบบนเครื่องนี้ (localhost · ชื่อฐานลงท้าย _docs หรือ _test)');
  }
  process.env.DATABASE_URL = url;
  process.env.PGSCHEMA = 'jarvis_rm';
  process.env.PG_SSL = 'false';
  process.env.AUTH_JWT_SECRET = 'integration-test-secret-not-used-anywhere-else-0123456789';
  process.env.DOCUMENTS_LINE_MOCK = '1';
  process.env.SIAMRAJ_UNIT_REQUESTS_ENABLED = 'false';
  process.env.DOCUMENT_OUTBOX_WORKER_ENABLED = 'false';
  delete process.env.APP_PUBLIC_URL;
}

export const ORIGIN = 'http://localhost:8091';
export const HOST = 'localhost:8091';

// ─── ยิง handler ─────────────────────────────────────────────────────────────
/** คำตอบ JSON ของเส้น API — ชนิดเดียวกับผลของ JSON.parse (เทสต์อ่านลึกหลายเส้น ไม่ประกาศชนิดทีละเส้น) */
export type Json = ReturnType<typeof JSON.parse>;
export type Reply = { status: number; json: Json; headers: Record<string, string | string[]>; bytes: Buffer | null };
type Handler = (req: Json, res: Json) => Promise<void>;

export async function call(
  handler: Handler,
  input: { method?: string; query?: Record<string, unknown>; body?: unknown; cookie?: string | null; origin?: string | null; headers?: Record<string, string> } = {},
): Promise<Reply> {
  const headers: Record<string, string> = { host: HOST, 'user-agent': 'vitest-documents', ...(input.headers ?? {}) };
  if (input.origin !== null) headers.origin = input.origin ?? ORIGIN;
  if (input.cookie) headers.cookie = input.cookie;
  const reply: Reply = { status: 0, json: null, headers: {}, bytes: null };
  const res = {
    setHeader(name: string, value: string | string[]) {
      reply.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      reply.status = code;
      return {
        json(body: unknown) {
          reply.json = body;
        },
        end(chunk?: string | Buffer) {
          reply.bytes = chunk === undefined ? Buffer.alloc(0) : Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        },
      };
    },
  };
  await handler({ method: input.method ?? 'GET', query: input.query ?? {}, body: input.body, headers }, res);
  return reply;
}

/** คุกกี้ที่ handler ตั้ง (ชื่อ=ค่า) */
export function cookieOf(reply: Reply): string {
  const raw = reply.headers['set-cookie'];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return String(first ?? '').split(';')[0];
}

// ─── ภาพจำลอง ─────────────────────────────────────────────────────────────────
const CRC = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc = (b: Buffer) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8);
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

/** PNG RGBA จริง (ถอดได้) — `pixel(x, y)` คืน [r, g, b, a] */
export function png(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = y * (width * 4 + 1) + 1 + x * 4;
      const c = pixel(x, y);
      raw[o] = c[0];
      raw[o + 1] = c[1];
      raw[o + 2] = c[2];
      raw[o + 3] = c[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** ภาพ "เอกสาร" จำลอง — ลายต่างกันตาม seed (แฮชไม่ซ้ำกัน) */
export function documentImage(seed: number, width = 640, height = 400): Buffer {
  let s = seed * 9301 + 49297;
  return png(width, height, (x, y) => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const v = 200 + ((s >> 16) % 50);
    const line = y % 40 < 3 && x > 40 && x < width - 40;
    return line ? [40, 40, 60, 255] : [v, v, v, 255];
  });
}

/** หน้าต้นฉบับจำลอง (เบา) */
export const templatePage = (seed: number): Buffer =>
  png(300, 424, (x, y) => ((x + y * seed) % 37 === 0 ? [60, 60, 90, 255] : [255, 255, 255, 255]));

/** ลายเซ็นจำลอง — เส้นทแยงบนพื้นโปร่งใส */
export const signaturePng = (): Buffer =>
  png(320, 110, (x, y) => (Math.abs(y - (20 + Math.round((x / 320) * 70))) <= 1 && x > 20 && x < 300 ? [48, 51, 59, 255] : [0, 0, 0, 0]));
export const dataUrl = (bytes: Buffer): string => `data:image/png;base64,${bytes.toString('base64')}`;

// ─── บัญชี LINE จำลอง ─────────────────────────────────────────────────────────
export function mockLineToken(name: string, opts: { sub?: string; picture?: string | null } = {}): { token: string; sub: string } {
  const sub = opts.sub ?? `U${randomUUID().replace(/-/g, '')}`;
  const claims: Record<string, unknown> = { sub, name };
  if (opts.picture) claims.picture = opts.picture;
  return { token: `mock.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`, sub };
}

/** เลขบัตรประชาชนจำลองที่หลักตรวจถูก (ไม่ใช่ของใคร — ขึ้นต้น 0 ซึ่งไม่ออกให้บุคคล) */
export function fakeNationalId(n: number): string {
  const base = `0${String(n).padStart(11, '0')}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (13 - i);
  return base + String((11 - (sum % 11)) % 10);
}
