/**
 * ═══ เครื่องมือของผู้ช่วย AI — "ค้นคำสั่ง" กับ "เรียกคำสั่ง" ของ Jarvis (เจ้าของ 13 พ.ย. 2569 · แปลงจาก KNOWA) ═══
 *
 * หลักความปลอดภัย:
 *   ① AI เรียกเส้นตัวเดียวกับปุ่มบนจอ **ด้วยคุกกี้ของคนที่สั่ง** — อ่านเรียก handler ในตัว (ไม่ผ่านเน็ต) ส่ง header เดิมทั้งชุด
 *      ⇒ ด่านสิทธิ์ · ขอบเขต BU · audit ทำงานเหมือนกดเอง · ทำได้ไม่เกินสิทธิ์คนสั่ง
 *   ② อ่าน (GET) ทำทันทีฝั่งเซิร์ฟเวอร์ · เปลี่ยนข้อมูล **ไม่ทำที่นี่** — ส่งกลับเป็นการ์ดให้คนกด "ทำเลย" แล้วเบราว์เซอร์ยิงเอง
 *   ③ ทุกอย่างที่ส่งให้ OpenAI ปิดเบอร์ · อีเมล · เลข 13 หลักก่อนเสมอ (`maskPersonal`)
 *   ④ ห้ามสั่งงานที่ไปถึงคนจริง (Lumos โทร · Autopost · Scrap · ส่งข้อความออก) — เจ้าของ Choice "ไม่ให้สั่งเลย"
 *      ตัดสินจากโค้ดจริงตอนสร้างสารบัญ (`reachesPeople`) + เส้นที่เปลี่ยนวิธีที่ AI โทรหาคน (รายการ `WRITE_BLOCKED`)
 */
import { API_CATALOG, type ApiCatalogEntry } from './apiCatalog.generated.js';
import type { ApiReq, ApiRes } from '../http.js';
import type { ToolSpec } from './openai.js';

/** ห้ามทุก method — ระบบล็อกอิน · ตัวผู้ช่วยเอง · กุญแจ/ความลับ · หน้าสาธารณะ · เส้นของระบบอื่น */
const BLOCKED: { re: RegExp; why: string }[] = [
  { re: /^\/api\/auth\//, why: 'ระบบเข้าสู่ระบบต้องทำเองที่หน้าจอ' },
  { re: /^\/api\/ai\//, why: 'ตัวผู้ช่วยเอง' },
  { re: /^\/api\/(ai-settings|integration-keys)$/, why: 'กุญแจและการเชื่อมต่อต้องตั้งเองที่หน้าตั้งค่า' },
  { re: /^\/api\/public\//, why: 'หน้าสาธารณะสำหรับผู้สมัคร ไม่ใช่คำสั่งของเจ้าหน้าที่' },
  { re: /^\/api\/integrations\//, why: 'เส้นของระบบอื่น' },
  { re: /^\/api\/lumos\/(interview|reminder)\//, why: 'เส้นที่ Lumos เรียกเข้ามา' },
  { re: /^\/api\/(health|short-links\/resolve)$/, why: 'ไม่ใช่คำสั่งของผู้ใช้' },
];

/**
 * ห้ามเฉพาะคำสั่งที่เปลี่ยนข้อมูล — อัปโหลดไฟล์ + ตั้งค่าที่เปลี่ยนวิธีที่ AI โทรหาคนจริง (โหมดส่ง · บทพูด · โทรซ้ำ · ย้ายใบอัตโนมัติ)
 * เส้นที่โค้ดไปถึง Lumos / So Scraping / ส่งข้อความออก กันจาก `reachesPeople` ของสารบัญอีกชั้น
 */
const WRITE_BLOCKED: { re: RegExp; why: string }[] = [
  { re: /^\/api\/(job-application-document|siamraj\/opl-import)$/, why: 'อัปโหลดไฟล์ต้องทำจากหน้าจอ' },
  {
    re: /^\/api\/(lumos\/dispatch-mode|call-scripts|call-followup-policy|application-auto-move|application-auto-move-status)$/,
    why: 'เปลี่ยนวิธีที่ AI โทรหาคนจริง ต้องตั้งเองที่หน้าตั้งค่า',
  },
];
const PEOPLE_WHY = 'คำสั่งนี้ไปถึงคนจริง (AI โทร · โพสต์ · Scrap · ส่งข้อความ) ต้องกดเองที่หน้าจอ';

const ENTRY = new Map(API_CATALOG.map((e) => [e.path, e]));

export type ResolvedCall = { ok: true; entry: ApiCatalogEntry; path: string; pathname: string } | { ok: false; message: string };

/** คำสั่งที่ AI ขอ: เส้นมีจริง · method มีจริง · ไม่อยู่ในรายการห้าม */
export function resolveCall(method: string, rawPath: string): ResolvedCall {
  const m = method.toUpperCase();
  if (!rawPath.startsWith('/api/') || rawPath.includes('..') || /\s/.test(rawPath)) {
    return { ok: false, message: 'path ต้องขึ้นต้นด้วย /api/ ของระบบนี้' };
  }
  const pathname = rawPath.split('?')[0].replace(/\/+$/, '');
  const blocked = BLOCKED.find((b) => b.re.test(pathname));
  if (blocked) return { ok: false, message: `ผู้ช่วยทำคำสั่งนี้ไม่ได้: ${blocked.why}` };
  const entry = ENTRY.get(pathname);
  if (!entry) return { ok: false, message: `ไม่มีคำสั่ง ${pathname} ในระบบ — ใช้ search_api หาก่อน` };
  if (!entry.methods.includes(m)) return { ok: false, message: `${pathname} รับเฉพาะ ${entry.methods.join('/')}` };
  if (m !== 'GET') {
    const wb = WRITE_BLOCKED.find((b) => b.re.test(pathname));
    if (wb) return { ok: false, message: `ผู้ช่วยทำคำสั่งนี้ไม่ได้: ${wb.why}` };
    if (entry.reachesPeople) return { ok: false, message: `ผู้ช่วยทำคำสั่งนี้ไม่ได้: ${PEOPLE_WHY}` };
  }
  return { ok: true, entry, path: rawPath, pathname };
}

/** เส้นนี้ผู้ช่วยสั่งเขียนได้ไหม (ใช้ทำสารบัญ) */
function writable(e: ApiCatalogEntry): boolean {
  return !e.reachesPeople && !WRITE_BLOCKED.some((b) => b.re.test(e.path));
}
const listed = (e: ApiCatalogEntry) => !BLOCKED.some((b) => b.re.test(e.path));
/** ป้ายของเส้นที่ผู้ช่วยสั่งเขียนไม่ได้ — มี GET = อ่านได้อย่างเดียว · ไม่มี GET = ใช้ไม่ได้เลย */
const lockTag = (e: ApiCatalogEntry) => (e.methods.includes('GET') ? ' [อ่านอย่างเดียว]' : ' [ผู้ช่วยใช้ไม่ได้]');

/**
 * ปิดข้อมูลติดต่อและเลขบัตรก่อนส่งให้ OpenAI — อีเมล · เลข 13 หลัก (มี/ไม่มีขีด) · เบอร์มือถือ/บ้าน (0x · +66 · 66)
 * Jarvis มีข้อมูลผู้สมัครเยอะ ⇒ ปิดทุกข้อความ ทั้งผลอ่าน ผลคำสั่ง และข้อความที่ผู้ใช้พิมพ์
 */
export function maskPersonal(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[อีเมล]')
    .replace(/(?<![\d-])\d-?\d{4}-?\d{5}-?\d{2}-?\d(?![\d-])/g, '[เลข 13 หลัก]')
    .replace(/(?<![\d-])(?:\+?66[\s-]?|0)(?:[689]\d(?:[\s-]?\d){7}|[2-7](?:[\s-]?\d){7})(?![\d-])/g, '[เบอร์]');
}

const MAX_RESULT = 24_000;
export function clip(text: string): string {
  return text.length > MAX_RESULT ? `${text.slice(0, MAX_RESULT)}\n…(ตัดเหลือ ${MAX_RESULT} ตัวอักษร — กรองให้แคบลงถ้าต้องการส่วนที่เหลือ)` : text;
}

/**
 * อ่านข้อมูล (GET) ด้วยสิทธิ์ของคนที่สั่ง — เรียก handler ในตัวด้วย header ชุดเดิม (คุกกี้ล็อกอินของเขา)
 * ไม่ยิงผ่านเน็ต ⇒ ไม่ต้องรู้ที่อยู่เซิร์ฟเวอร์ ไม่ติด nginx · ไม่เจอ = บอก AI ตรง ๆ
 */
export async function runRead(rawPath: string, headers: ApiReq['headers']): Promise<string> {
  const url = new URL(rawPath, 'http://jarvis.local');
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    query[k] = v;
  });
  const { apiRoutes } = await import('../../_handlers/registry.js');
  const handler = apiRoutes[url.pathname.replace(/\/+$/, '')];
  if (!handler) return 'HTTP 404\nไม่มีคำสั่งนี้';
  let status = 200;
  let payload = '';
  const res: ApiRes = {
    setHeader: () => undefined,
    status: (code: number) => {
      status = code;
      return {
        json: (body: unknown) => {
          payload = JSON.stringify(body);
        },
        end: (chunk?: string) => {
          payload = chunk ?? '';
        },
      };
    },
  };
  await handler({ method: 'GET', query, headers: { ...headers }, body: undefined }, res);
  return clip(`HTTP ${status}\n${maskPersonal(payload)}`);
}

/** ค้นคำสั่งจากคำค้น — คืนคำอธิบายเต็มของเส้น (หัวคอมเมนต์ทั้งก้อน · ไม่ตัด) + ช่อง query/body ที่โค้ดอ่าน */
export function searchApi(keywords: string): string {
  // ถอดเครื่องหมายคำพูด/วงเล็บที่ AI ชอบใส่มา (บทเรียน KNOWA) — เหลือ . _ - ไว้เพราะเป็นส่วนของชื่อ
  const words = keywords
    .toLowerCase()
    .replace(/[^\p{L}\p{N}._\-\s,/]/gu, ' ')
    .split(/[\s,/]+/)
    .filter((w) => w.length > 1);
  const scored = API_CATALOG.filter(listed)
    .map((e) => {
      const hay = `${e.path} ${e.doc} ${e.query.join(' ')} ${e.body.join(' ')}`.toLowerCase();
      const score = words.reduce((s, w) => s + (e.path.toLowerCase().includes(w) ? 3 : 0) + (hay.includes(w) ? 1 : 0), 0);
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  if (!scored.length) return 'ไม่เจอคำสั่งที่ตรง — ลองคำค้นอื่น (คำในชื่อเส้น เช่น job-applications, unit-requests, follow) หรือคำไทยในคำอธิบาย';
  return clip(
    scored
      .map(
        ({ e }) =>
          `${e.methods.join('/')} ${e.path}${writable(e) ? '' : e.methods.includes('GET') ? '  (ผู้ช่วยอ่านได้อย่างเดียว)' : '  (ผู้ช่วยใช้ไม่ได้)'}\n${e.doc}` +
          (e.query.length ? `\nquery: ${e.query.join(', ')}` : '') +
          (e.body.length ? `\nbody: ${e.body.join(', ')}` : ''),
      )
      .join('\n\n────────\n\n'),
  );
}

/** สารบัญแบบย่อใส่ใน system prompt — บรรทัดแรกของคำอธิบาย · บอกว่าเส้นไหนอ่านได้อย่างเดียว */
export function apiIndex(): string {
  return API_CATALOG.filter(listed)
    .map((e) => {
      // บรรทัดแรกของคำอธิบาย — ตัด method/path ที่ซ้ำหัวบรรทัดออก ("`GET /api/x` — …")
      const first = (e.doc.split('\n').map((l) => l.replace(/[═]+/g, '').trim()).find(Boolean) ?? '')
        .replace(/^`?[A-Z/]+\s+\/api\/\S+?`?\s*[—-]\s*/, '')
        .trim();
      return `${e.methods.join('/')} ${e.path}${writable(e) ? '' : lockTag(e)}${first ? ` — ${first.slice(0, 90)}` : ''}`;
    })
    .join('\n');
}

export const AI_TOOLS: ToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'search_api',
      description: 'ค้นคำสั่งของระบบ Jarvis พร้อมคำอธิบายเต็มและช่องที่ต้องส่ง — เรียกก่อนสั่ง POST/PUT/PATCH/DELETE ทุกครั้ง',
      parameters: {
        type: 'object',
        properties: { keywords: { type: 'string', description: 'คำค้น เช่น "job-applications status" "ใบขอ หมายเหตุ"' } },
        required: ['keywords'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'call_api',
      description:
        'เรียกคำสั่งของระบบด้วยสิทธิ์ของผู้ใช้ · GET = อ่านทันที · POST/PUT/PATCH/DELETE = ขึ้นการ์ดให้ผู้ใช้กดยืนยันก่อน แล้วผลจะกลับมาเป็นข้อความของเครื่องมือ',
      parameters: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
          path: { type: 'string', description: 'เช่น /api/siamraj/unit-requests?limit=50 (ใส่ id จริงที่อ่านมา ห้ามเดา)' },
          body: { type: 'object', description: 'ข้อมูลที่ส่ง (JSON) ตามช่องของคำสั่ง', additionalProperties: true },
          summary_th: { type: 'string', description: 'สรุปภาษาไทยสั้น ๆ ว่าคำสั่งนี้จะทำอะไร ใช้เป็นหัวการ์ดยืนยัน' },
        },
        required: ['method', 'path', 'summary_th'],
      },
    },
  },
];
