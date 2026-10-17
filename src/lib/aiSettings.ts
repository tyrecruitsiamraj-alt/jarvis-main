/**
 * ═══ เลือก AI ที่ใช้คิดงานจากหน้าตั้งค่า (เจ้าของ 17 ต.ค. 2569) ═══
 *
 * > *"ตอนนี้เรามีใช้ Ai แต่หน้า UI ไม่มีให้เลือกพวก Model … อนาคตอยากจะเปลี่ยน … ต้องเปลี่ยนจากหน้า Ui ได้"*
 * Choice: รองรับ **Ollama + เจ้าแบบ OpenAI + Claude** · **เลือกแยกได้ต่องาน** · **admin เท่านั้น**
 *
 * ไฟล์นี้ pure ใช้ร่วมกันทั้งหน้าจอ/API/เทสต์ · ⚠️ AI ที่ **โทร** (Lumos) คนละเรื่อง ไม่อยู่ที่นี่
 * ไม่ได้ตั้งงานไหน = ใช้ Ollama จากไฟล์ตั้งค่าเซิร์ฟเวอร์ (`OLLAMA_BASE_URL`/`OLLAMA_MODEL`) แบบเดิม — ทางถอย
 */

export const AI_TASKS = ['board_match', 'irecruit_match', 'recruit_lane', 'selection_recall', 'candidate_spec'] as const;
export type AiTask = (typeof AI_TASKS)[number];

/** ชื่องานบนจอ — คำเดียวกับที่ทีมเรียก */
export const AI_TASK_LABEL: Record<AiTask, string> = {
  board_match: 'จับคู่คนของเรากับใบขอ',
  irecruit_match: 'หาคนที่ยังไม่สมัครจาก iRecruit',
  recruit_lane: 'เลนสรรหา (หาคนจากกองสมัคร)',
  selection_recall: 'ชวนกลับคนที่เคยปฏิเสธ',
  candidate_spec: 'อ่านสเปคใบขอ',
};

export const AI_PROVIDER_KINDS = ['ollama', 'openai', 'anthropic'] as const;
export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];

export const AI_PROVIDER_LABEL: Record<AiProviderKind, string> = {
  ollama: 'Ollama',
  openai: 'OpenAI หรือเจ้าที่ใช้รูปแบบเดียวกัน',
  anthropic: 'Claude (Anthropic)',
};

/** ที่อยู่ตั้งต้นของแต่ละเจ้า — Ollama ไม่มีค่าตั้งต้น (เป็นเครื่องของเราเอง) */
export const AI_PROVIDER_DEFAULT_URL: Record<AiProviderKind, string> = {
  ollama: '',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
};

/** เจ้าที่ต้องมี API key — Ollama ของเราไม่ต้อง */
export function aiKindNeedsKey(kind: AiProviderKind): boolean {
  return kind !== 'ollama';
}

export function isAiTask(v: unknown): v is AiTask {
  return typeof v === 'string' && (AI_TASKS as readonly string[]).includes(v);
}

export function isAiProviderKind(v: unknown): v is AiProviderKind {
  return typeof v === 'string' && (AI_PROVIDER_KINDS as readonly string[]).includes(v);
}

/** การเชื่อมต่อที่หน้าจอเห็น — **ไม่มีตัว key** มีแค่ 4 ตัวท้ายให้รู้ว่าตั้งไว้แล้ว */
export type AiConnectionView = {
  id: string;
  name: string;
  kind: AiProviderKind;
  base_url: string;
  model: string;
  has_key: boolean;
  key_hint: string | null;
  updated_by: string | null;
  updated_at: string | null;
};

export type AiTaskRouteView = {
  task: AiTask;
  /** null = ใช้ Ollama จากไฟล์ตั้งค่าเซิร์ฟเวอร์ */
  connection_id: string | null;
  /** ว่าง = ใช้โมเดลตั้งต้นของการเชื่อมต่อ */
  model: string | null;
  updated_by: string | null;
  updated_at: string | null;
};

export type AiSettingsView = {
  connections: AiConnectionView[];
  routes: AiTaskRouteView[];
  /** Ollama จากไฟล์ตั้งค่าเซิร์ฟเวอร์ — null = ไม่ได้ตั้ง */
  env_default: { base_url: string; model: string } | null;
};

/** 4 ตัวท้ายของ key ไว้โชว์ว่า "ตั้งไว้แล้ว" — สั้นกว่า 8 ตัว = ไม่โชว์อะไรเลย กันเดา key ทั้งตัว */
export function aiKeyHint(key: string): string | null {
  const k = key.trim();
  return k.length >= 8 ? k.slice(-4) : null;
}

export type AiConnectionInput = {
  id?: string;
  name: string;
  kind: AiProviderKind;
  base_url: string;
  model: string;
  /** undefined/'' = คง key เดิม · ส่งค่าใหม่ = เปลี่ยน */
  api_key?: string;
  /** true = ลบ key เดิมทิ้ง */
  clear_key?: boolean;
};

/** ตรวจค่าที่ส่งมาตอนบันทึกการเชื่อมต่อ — ข้อความ error เป็นคำบนจอ */
export function parseAiConnectionInput(raw: unknown): { value?: AiConnectionInput; error?: string } {
  if (!raw || typeof raw !== 'object') return { error: 'ข้อมูลไม่ถูกต้อง' };
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const name = str(r.name);
  const kind = r.kind;
  if (!name) return { error: 'ใส่ชื่อการเชื่อมต่อ' };
  if (name.length > 80) return { error: 'ชื่อยาวเกินไป' };
  if (!isAiProviderKind(kind)) return { error: 'เลือกเจ้า AI' };
  const base = (str(r.base_url) || AI_PROVIDER_DEFAULT_URL[kind]).replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s]+$/i.test(base)) return { error: 'ที่อยู่เซิร์ฟเวอร์ต้องขึ้นต้นด้วย http:// หรือ https://' };
  const model = str(r.model);
  if (!model) return { error: 'ใส่ชื่อโมเดล' };
  if (model.length > 120) return { error: 'ชื่อโมเดลยาวเกินไป' };
  const apiKey = typeof r.api_key === 'string' ? r.api_key.trim() : undefined;
  if (apiKey && apiKey.length > 400) return { error: 'API key ยาวเกินไป' };
  const id = str(r.id) || undefined;
  return {
    value: { id, name, kind, base_url: base, model, api_key: apiKey || undefined, clear_key: r.clear_key === true },
  };
}

/** ตรวจค่าที่ส่งมาตอนเลือก AI ต่องาน */
export function parseAiRoutesInput(raw: unknown): { value?: Array<{ task: AiTask; connection_id: string | null; model: string | null }>; error?: string } {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { routes?: unknown }).routes)) {
    return { error: 'ข้อมูลไม่ถูกต้อง' };
  }
  const out: Array<{ task: AiTask; connection_id: string | null; model: string | null }> = [];
  for (const it of (raw as { routes: unknown[] }).routes) {
    if (!it || typeof it !== 'object') return { error: 'ข้อมูลไม่ถูกต้อง' };
    const r = it as Record<string, unknown>;
    if (!isAiTask(r.task)) return { error: 'ไม่รู้จักงานนี้' };
    const conn = typeof r.connection_id === 'string' && r.connection_id.trim() ? r.connection_id.trim() : null;
    const model = typeof r.model === 'string' && r.model.trim() ? r.model.trim().slice(0, 120) : null;
    out.push({ task: r.task, connection_id: conn, model });
  }
  return { value: out };
}
