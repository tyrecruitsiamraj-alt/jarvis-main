/**
 * ═══ Flow ระบบ — กดปุ่มไหนไปไหน (เจ้าของ 13 พ.ย. 2569 "แบบ N8N … แยกเป็น menu แล้วถ้าปุ่มไหนกดแล้วไปโยงกะ menu อื่นก็ลากให้ดู") ═══
 * pure: รับรายการจอ (`flowScreens.json` — ไล่จากโค้ดจริงทุกปุ่ม พร้อมไฟล์:บรรทัด) → กล่อง + เส้น + ปุ่มที่หาปลายทางไม่เจอ
 * ปลายทางหาจาก: route (รวม `:id` / `?view=`) · ชื่อป๊อป/แท็บ · ระบบภายนอก · ผลข้างเคียงที่ไปถึงระบบภายนอก (ส่ง Lumos โทร ฯลฯ ลากเส้นไปกล่องระบบนั้นด้วย)
 * ⚠️ หาไม่เจอ = โชว์ในรายการ "ยังโยงไม่ได้" ห้ามเดาเส้น (บทเรียน: Flow ต้องครบและจริง)
 */

export const FLOW_EFFECTS = ['เขียนฐาน', 'ส่ง Lumos โทร', 'สั่ง So Scraping', 'อ่าน ERP', 'อ่าน iRecruit', 'ส่งข้อความออก', 'เรียก AI'] as const;
export type FlowEffect = (typeof FLOW_EFFECTS)[number];
/** inline = เปิด/ปิด/สลับของในจอเดิม (กางแถว · ปิดป๊อป · ขั้นถัดไป) — ไม่มีจอปลายทาง จึงไม่มีเส้น */
export type FlowAction = 'navigate' | 'popup' | 'tab' | 'api' | 'external' | 'filter' | 'inline';

export type FlowControl = {
  label: string;
  action: FlowAction;
  target: string | null;
  api: string | null;
  effects: string[];
  when: string | null;
  src: string;
};
export type FlowScreen = {
  id: string;
  kind: 'page' | 'popup' | 'tab' | 'system';
  title: string;
  route: string | null;
  /** เส้นทางอื่นที่เปิดจอเดียวกัน (เช่น /opl /sale /staff ใช้หน้าเดียว) */
  aliases?: string[];
  parent: string | null;
  src: string;
  controls: FlowControl[];
};

/** ระบบภายนอก — กล่องปลายทางของปุ่มที่ออกนอก Jarvis หรือมีผลข้างเคียงถึงระบบนั้น */
export const FLOW_SYSTEMS: Array<{ id: string; title: string; match: RegExp; effect?: FlowEffect }> = [
  { id: 'sys-lumos', title: 'Lumos (AI โทรหาคน)', match: /lumos/i, effect: 'ส่ง Lumos โทร' },
  { id: 'sys-so', title: 'So Scraping (Autopost · Scrap)', match: /so[\s-]?scraping|autopost|scrap/i, effect: 'สั่ง So Scraping' },
  { id: 'sys-erp', title: 'ERP สยามราชธานี', match: /\berp\b/i, effect: 'อ่าน ERP' },
  { id: 'sys-irecruit', title: 'iRecruit', match: /irecruit/i, effect: 'อ่าน iRecruit' },
  { id: 'sys-message', title: 'ส่งข้อความออก (LINE · อีเมล)', match: /line|อีเมล|email|sms/i, effect: 'ส่งข้อความออก' },
  { id: 'sys-ai', title: 'AI (Ollama · OpenAI)', match: /openai|ollama|\bai\b/i, effect: 'เรียก AI' },
  { id: 'sys-facebook', title: 'Facebook', match: /facebook/i },
  { id: 'sys-phone', title: 'โทรศัพท์ / แอปภายนอก', match: /tel:|โทรออก|phone|google maps|maps/i },
  { id: 'sys-device', title: 'เครื่องของคนกด (ไฟล์ · คลิปบอร์ด · พิมพ์)', match: /คลิปบอร์ด|ดาวน์โหลด|ไฟล์|window\.print|\bpdf\b|\bcsv\b|\bpng\b/i },
];

export type FlowEdge = { id: string; from: string; control: number; to: string; kind: 'go' | 'effect'; effect?: FlowEffect };
export type FlowUnresolved = { screen: string; control: number; label: string; target: string | null };

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** route ของปุ่ม (อาจมีค่าจริง/พารามิเตอร์) ตรงกับ route ของจอไหม — `:id` = ส่วนใดก็ได้ · query ของจอต้องอยู่ในปุ่ม */
export function routeMatches(screenRoute: string, target: string): boolean {
  const [sPath, sQuery = ''] = screenRoute.split('?');
  const [tPath, tQuery = ''] = target.split('?');
  const re = new RegExp('^' + sPath.replace(/[.+*^$()|[\]\\]/g, '\\$&').replace(/:[A-Za-z_]+/g, '[^/]+') + '/?$');
  if (!re.test(tPath) && sPath !== tPath) return false;
  if (!sQuery) return true;
  const want = new URLSearchParams(sQuery);
  const have = new URLSearchParams(tQuery);
  return [...want.entries()].every(([k, v]) => have.get(k) === v);
}

/** เส้นทางทุกเส้นที่เขียนไว้ในปลายทางของปุ่ม — ปุ่มเดียวพาไปได้หลายหน้าตามเงื่อนไข (เช่น "งานถัดไป" · ย้อนกลับ) · `?view=x` = ต่อท้าย route ของเมนูที่ปุ่มอยู่ */
export function routesIn(target: string, base = ''): string[] {
  return [...target.matchAll(/(?:^|[\s(])([/?][^\s()·,…|]*)/g)]
    .map((m) => m[1].replace(/[.…]+$/, ''))
    .filter((r) => r && (r.startsWith('/') || base))
    .map((r) => (r.startsWith('?') ? base + r : r));
}

/** route ของเมนูที่จอนี้อยู่ (ไล่ขึ้นจอแม่จนเจอจอที่มี route · ตัด query ออก) */
function baseRouteOf(screens: readonly FlowScreen[], from: FlowScreen): string {
  const byId = new Map(screens.map((s) => [s.id, s]));
  const seen = new Set<string>();
  for (let cur: FlowScreen | undefined = from; cur && !seen.has(cur.id); cur = cur.parent ? byId.get(cur.parent) : undefined) {
    seen.add(cur.id);
    if (cur.route) return cur.route.split('?')[0];
  }
  return '';
}

/** จอปลายทางทั้งหมดของปุ่ม — route ยาว/เจาะจงที่สุดชนะ + id จอที่เขียนไว้ตรง ๆ · ไม่มีจึงหาจากชื่อป๊อป/แท็บ (ในจอแม่ก่อน) · ระบบภายนอก */
export function resolveTargets(screens: readonly FlowScreen[], from: FlowScreen, c: FlowControl): string[] {
  const t = (c.target ?? '').trim();
  if (!t) return [];
  const out: string[] = [];
  for (const r of routesIn(t, baseRouteOf(screens, from))) {
    const hits = screens
      .map((s) => ({ s, route: [s.route, ...(s.aliases ?? [])].filter((x): x is string => Boolean(x) && routeMatches(x!, r)).sort((a, b) => b.length - a.length)[0] }))
      .filter((h) => h.route);
    hits.sort((a, b) => (b.route!.length - a.route!.length) || (a.s.kind === 'page' ? -1 : 1));
    if (hits[0] && !out.includes(hits[0].s.id)) out.push(hits[0].s.id);
  }
  const ids = new Set(screens.map((s) => s.id));
  for (const w of t.split(/[^A-Za-z0-9_-]+/)) if (ids.has(w) && (w === t || w.includes('-')) && !out.includes(w)) out.push(w);
  if (out.length) return out;
  if (c.action === 'popup' || c.action === 'tab') {
    const byTitle = (s: FlowScreen) => (s.kind === 'popup' || s.kind === 'tab') && (norm(s.title) === norm(t) || norm(t).includes(norm(s.title)) || norm(s.title).includes(norm(t)));
    const child = screens.find((s) => s.parent === from.id && byTitle(s)) ?? screens.find(byTitle);
    if (child) return [child.id];
  }
  if (c.action === 'external') {
    const sys = FLOW_SYSTEMS.find((x) => x.match.test(t));
    if (sys) return [sys.id];
  }
  return [];
}

export function resolveTarget(screens: readonly FlowScreen[], from: FlowScreen, c: FlowControl): string | null {
  return resolveTargets(screens, from, c)[0] ?? null;
}

export function buildFlowGraph(screens: readonly FlowScreen[]): { edges: FlowEdge[]; unresolved: FlowUnresolved[]; systemsUsed: Set<string> } {
  const edges: FlowEdge[] = [];
  const unresolved: FlowUnresolved[] = [];
  const systemsUsed = new Set<string>();
  for (const s of screens) {
    s.controls.forEach((c, i) => {
      if (c.action !== 'filter' && c.action !== 'api' && c.action !== 'inline') {
        const tos = resolveTargets(screens, s, c);
        if (!tos.length) unresolved.push({ screen: s.id, control: i, label: c.label, target: c.target });
        for (const to of tos) {
          if (to === s.id) continue;
          edges.push({ id: `${s.id}#${i}>${to}`, from: s.id, control: i, to, kind: 'go' });
          if (to.startsWith('sys-')) systemsUsed.add(to);
        }
      }
      for (const e of c.effects) {
        const sys = FLOW_SYSTEMS.find((x) => x.effect === e);
        if (!sys) continue;
        systemsUsed.add(sys.id);
        edges.push({ id: `${s.id}#${i}~${sys.id}`, from: s.id, control: i, to: sys.id, kind: 'effect', effect: e as FlowEffect });
      }
    });
  }
  return { edges, unresolved, systemsUsed };
}

/** เมนูหลักของจอ (ไล่ขึ้นไปหาจอแม่ชั้นบนสุด) — ใช้จัดกลุ่ม/กรองบนผัง */
export function menuOf(screens: readonly FlowScreen[], id: string): string {
  const byId = new Map(screens.map((s) => [s.id, s]));
  let cur = byId.get(id);
  const seen = new Set<string>();
  while (cur?.parent && byId.has(cur.parent) && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.parent);
  }
  return cur?.id ?? id;
}
