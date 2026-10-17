import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldSelect } from '@/components/shared/FieldSelect';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import {
  AI_PROVIDER_DEFAULT_URL,
  AI_PROVIDER_KINDS,
  AI_PROVIDER_LABEL,
  AI_TASKS,
  AI_TASK_LABEL,
  aiKindNeedsKey,
  type AiConnectionInput,
  type AiProviderKind,
  type AiSettingsView,
  type AiTask,
} from '@/lib/aiSettings';
import {
  deleteAiConnection,
  fetchAiSettings,
  listAiModels,
  saveAiConnection,
  saveAiRoutes,
  testAiConnection,
  type AiTestResult,
} from '@/lib/aiSettingsApi';

/**
 * ตั้งค่า › AI ที่ใช้คิดงาน (เจ้าของ 17 ต.ค. 2569: *"ต้องเปลี่ยนจากหน้า Ui ได้"*)
 * Choice: Ollama + เจ้าแบบ OpenAI + Claude · เลือกแยกได้ต่องาน · admin เท่านั้น
 *
 * - งานไหนใช้ตัวไหน: 5 งาน · ไม่เลือก = Ollama ของระบบ (ไฟล์ตั้งค่าเซิร์ฟเวอร์) แบบเดิม
 * - การเชื่อมต่อ: เพิ่ม/แก้/ลบ/ทดสอบ · API key ไม่เคยกลับมาที่จอ (เห็นแค่ 4 ตัวท้าย) · ช่องว่าง = คง key เดิม
 * ⚠️ AI ที่โทร (Lumos) ไม่อยู่ที่นี่
 */

type ConnDraft = AiConnectionInput & { key: string; has_key: boolean; key_hint: string | null };
type RouteDraft = { connection_id: string; model: string };

const NEW_PREFIX = 'new-';

function toDrafts(s: AiSettingsView): ConnDraft[] {
  return s.connections.map((c) => ({
    key: c.id,
    id: c.id,
    name: c.name,
    kind: c.kind,
    base_url: c.base_url,
    model: c.model,
    api_key: '',
    has_key: c.has_key,
    key_hint: c.key_hint,
  }));
}

function toRouteDrafts(s: AiSettingsView): Record<AiTask, RouteDraft> {
  const out = {} as Record<AiTask, RouteDraft>;
  for (const t of AI_TASKS) {
    const r = s.routes.find((x) => x.task === t);
    out[t] = { connection_id: r?.connection_id ?? '', model: r?.model ?? '' };
  }
  return out;
}

const secs = (ms: number) => `${(ms / 1000).toLocaleString('th-TH', { maximumFractionDigits: 1 })} วิ`;

function TestLine({ r }: { r: AiTestResult | 'busy' | undefined }) {
  if (!r) return null;
  if (r === 'busy') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs', DASH.muted)}>
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> กำลังทดสอบ…
      </span>
    );
  }
  return r.ok ? (
    <span className={cn('text-xs font-medium', TONE.success.value)}>ใช้ได้ · ตอบใน {secs(r.ms)}</span>
  ) : (
    <span className={cn('text-xs font-medium', TONE.danger.value)}>ใช้ไม่ได้ · {r.error}</span>
  );
}

const AiSettingsTab: React.FC = () => {
  const [view, setView] = useState<AiSettingsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conns, setConns] = useState<ConnDraft[]>([]);
  const [routes, setRoutes] = useState<Record<AiTask, RouteDraft> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, AiTestResult | 'busy'>>({});
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const apply = useCallback((s: AiSettingsView) => {
    setView(s);
    setConns(toDrafts(s));
    setRoutes(toRouteDrafts(s));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      apply(await fetchAiSettings());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดการตั้งค่า AI ไม่สำเร็จ');
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  const savedConns = useMemo(() => view?.connections ?? [], [view]);
  const envLabel = view?.env_default ? `Ollama ของระบบ · ${view.env_default.model}` : 'Ollama ของระบบ (ยังไม่ได้ตั้ง)';
  const connOptions = useMemo(
    () => [{ value: '', label: envLabel }, ...savedConns.map((c) => ({ value: c.id, label: `${c.name} · ${AI_PROVIDER_LABEL[c.kind]}` }))],
    [savedConns, envLabel],
  );

  const routesDirty = useMemo(() => {
    if (!view || !routes) return false;
    const base = toRouteDrafts(view);
    return AI_TASKS.some((t) => base[t].connection_id !== routes[t].connection_id || base[t].model.trim() !== routes[t].model.trim());
  }, [view, routes]);

  const patchConn = (key: string, patch: Partial<ConnDraft>) =>
    setConns((cur) => cur.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const inputOf = (c: ConnDraft): AiConnectionInput => ({
    id: c.key.startsWith(NEW_PREFIX) ? undefined : c.id,
    name: c.name,
    kind: c.kind,
    base_url: c.base_url,
    model: c.model,
    api_key: c.api_key?.trim() || undefined,
  });

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ทำไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const testConn = async (c: ConnDraft) => {
    setTests((t) => ({ ...t, [c.key]: 'busy' }));
    try {
      const r = await testAiConnection({ connection: inputOf(c) });
      setTests((t) => ({ ...t, [c.key]: r }));
    } catch (e) {
      setTests((t) => ({ ...t, [c.key]: { ok: false, ms: 0, error: e instanceof Error ? e.message : 'ทดสอบไม่สำเร็จ' } }));
    }
  };

  const testRoute = async (task: AiTask) => {
    if (!routes) return;
    const r = routes[task];
    const k = `route-${task}`;
    setTests((t) => ({ ...t, [k]: 'busy' }));
    try {
      const res = r.connection_id
        ? await testAiConnection({ connection_id: r.connection_id, model: r.model || null })
        : view?.env_default
          ? await testAiConnection({
              connection: { name: 'Ollama ของระบบ', kind: 'ollama', base_url: view.env_default.base_url, model: r.model || view.env_default.model },
            })
          : { ok: false, ms: 0, error: 'ยังไม่ได้ตั้ง Ollama ของระบบ' };
      setTests((t) => ({ ...t, [k]: res }));
    } catch (e) {
      setTests((t) => ({ ...t, [k]: { ok: false, ms: 0, error: e instanceof Error ? e.message : 'ทดสอบไม่สำเร็จ' } }));
    }
  };

  const fetchModels = (c: ConnDraft) =>
    run(`models-${c.key}`, async () => {
      const list = await listAiModels({ connection: inputOf(c) });
      setModels((m) => ({ ...m, [c.key]: list }));
      if (list.length === 0) setNotice(`ดึงรายชื่อโมเดลของ "${c.name || 'การเชื่อมต่อนี้'}" ไม่ได้ — พิมพ์ชื่อโมเดลเองได้`);
    });

  const addConn = () => {
    const key = `${NEW_PREFIX}${Date.now()}`;
    setConns((cur) => [
      ...cur,
      { key, name: '', kind: 'openai', base_url: AI_PROVIDER_DEFAULT_URL.openai, model: '', api_key: '', has_key: false, key_hint: null },
    ]);
  };

  if (error && !view) {
    return (
      <div className={cn('space-y-3 rounded-2xl border p-4', DASH.card)}>
        <p className={cn('text-sm', TONE.danger.value)}>{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          ลองใหม่
        </Button>
      </div>
    );
  }
  if (!view || !routes) {
    return (
      <p className={cn('inline-flex items-center gap-2 text-sm', DASH.muted)}>
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> กำลังโหลด…
      </p>
    );
  }

  return (
    <div className="space-y-6" data-testid="ai-settings">
      {error ? <p className={cn('rounded-xl border px-3 py-2 text-sm', TONE.danger.soft, TONE.danger.value)}>{error}</p> : null}
      {notice ? <p className={cn('rounded-xl border px-3 py-2 text-sm', TONE.success.soft, TONE.success.value)}>{notice}</p> : null}

      {/* ── งานไหนใช้ AI ตัวไหน ── */}
      <section className={cn('space-y-3 rounded-2xl border p-4', DASH.card)}>
        <h3 className="text-base font-medium">งานไหนใช้ AI ตัวไหน</h3>
        <ul className="space-y-3">
          {AI_TASKS.map((task) => {
            const r = routes[task];
            const conn = savedConns.find((c) => c.id === r.connection_id);
            const defaultModel = conn ? conn.model : (view.env_default?.model ?? '');
            return (
              <li key={task} className="grid gap-2 border-b pb-3 last:border-b-0 last:pb-0 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,12rem)_auto] md:items-center">
                <span className="text-sm font-medium">{AI_TASK_LABEL[task]}</span>
                <FieldSelect
                  value={r.connection_id}
                  onChange={(v) => setRoutes((cur) => (cur ? { ...cur, [task]: { connection_id: v, model: '' } } : cur))}
                  options={connOptions}
                  ariaLabel={`AI ของงาน ${AI_TASK_LABEL[task]}`}
                />
                <Input
                  value={r.model}
                  onChange={(e) => setRoutes((cur) => (cur ? { ...cur, [task]: { ...cur[task], model: e.target.value } } : cur))}
                  placeholder={defaultModel || 'โมเดล'}
                  aria-label={`โมเดลของงาน ${AI_TASK_LABEL[task]}`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void testRoute(task)}>
                    ทดสอบ
                  </Button>
                  <TestLine r={tests[`route-${task}`]} />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!routesDirty || busy === 'routes'}
            onClick={() =>
              void run('routes', async () => {
                apply(
                  await saveAiRoutes(
                    AI_TASKS.map((t) => ({ task: t, connection_id: routes[t].connection_id || null, model: routes[t].model.trim() || null })),
                  ),
                );
                setNotice('บันทึกแล้ว — งานที่เริ่มหลังจากนี้ใช้ AI ตัวใหม่ (ภายใน 30 วิ)');
              })
            }
          >
            {busy === 'routes' ? 'กำลังบันทึก…' : 'บันทึกการเลือก AI'}
          </Button>
          {routesDirty ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setRoutes(toRouteDrafts(view))}>
              คืนค่าเดิม
            </Button>
          ) : null}
        </div>
      </section>

      {/* ── การเชื่อมต่อ ── */}
      <section className={cn('space-y-3 rounded-2xl border p-4', DASH.card)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-medium">การเชื่อมต่อ</h3>
          <Button type="button" variant="outline" size="sm" onClick={addConn}>
            <Plus aria-hidden /> เพิ่มการเชื่อมต่อ
          </Button>
        </div>
        <p className={cn('text-xs', TONE.warn.value)}>
          เจ้าภายนอก (OpenAI · Claude) ได้รับสกิล อายุ และพื้นที่ของผู้สมัคร · ไม่มีชื่อและเบอร์
        </p>

        {conns.length === 0 ? (
          <p className={cn('rounded-xl border px-3 py-4 text-center text-sm', DASH.muted)}>ยังไม่มีการเชื่อมต่อ · ทุกงานใช้ {envLabel}</p>
        ) : null}

        {conns.map((c) => {
          const isNew = c.key.startsWith(NEW_PREFIX);
          const listId = `ai-models-${c.key}`;
          const needsKey = aiKindNeedsKey(c.kind);
          return (
            <div key={c.key} className="space-y-3 rounded-xl border p-3" data-testid="ai-connection">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`${c.key}-name`}>ชื่อ</Label>
                  <Input id={`${c.key}-name`} value={c.name} onChange={(e) => patchConn(c.key, { name: e.target.value })} placeholder="เช่น Claude ของบริษัท" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${c.key}-kind`}>เจ้า AI</Label>
                  <FieldSelect
                    id={`${c.key}-kind`}
                    value={c.kind}
                    onChange={(v) => {
                      const kind = v as AiProviderKind;
                      // เปลี่ยนเจ้า = ที่อยู่ตั้งต้นของเจ้าใหม่ (ถ้ายังเป็นที่อยู่ตั้งต้นของเจ้าเดิม)
                      const keepUrl = c.base_url && c.base_url !== AI_PROVIDER_DEFAULT_URL[c.kind];
                      patchConn(c.key, { kind, base_url: keepUrl ? c.base_url : AI_PROVIDER_DEFAULT_URL[kind] });
                    }}
                    options={AI_PROVIDER_KINDS.map((k) => ({ value: k, label: AI_PROVIDER_LABEL[k] }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${c.key}-url`}>ที่อยู่เซิร์ฟเวอร์</Label>
                  <Input
                    id={`${c.key}-url`}
                    value={c.base_url}
                    onChange={(e) => patchConn(c.key, { base_url: e.target.value })}
                    placeholder={c.kind === 'ollama' ? 'http://…:11434' : AI_PROVIDER_DEFAULT_URL[c.kind]}
                    inputMode="url"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${c.key}-model`}>โมเดลตั้งต้น</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`${c.key}-model`}
                      value={c.model}
                      onChange={(e) => patchConn(c.key, { model: e.target.value })}
                      list={listId}
                      placeholder={c.kind === 'anthropic' ? 'เช่น claude-sonnet-5-5' : c.kind === 'openai' ? 'เช่น gpt-4o-mini' : 'เช่น qwen3.5:9b'}
                    />
                    <Button type="button" variant="outline" size="sm" disabled={busy === `models-${c.key}`} onClick={() => void fetchModels(c)}>
                      {busy === `models-${c.key}` ? 'กำลังดึง…' : 'ดึงรายชื่อ'}
                    </Button>
                  </div>
                  <datalist id={listId}>
                    {(models[c.key] ?? []).map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                {needsKey ? (
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor={`${c.key}-key`}>API key</Label>
                    <Input
                      id={`${c.key}-key`}
                      type="password"
                      autoComplete="off"
                      value={c.api_key ?? ''}
                      onChange={(e) => patchConn(c.key, { api_key: e.target.value })}
                      placeholder={c.has_key ? `ตั้งไว้แล้ว ••••${c.key_hint ?? ''} · เว้นว่างไว้ = ใช้ key เดิม` : 'ใส่ API key'}
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void testConn(c)}>
                  ทดสอบ
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy === `save-${c.key}`}
                  onClick={() =>
                    void run(`save-${c.key}`, async () => {
                      apply(await saveAiConnection(inputOf(c)));
                      setNotice(`บันทึก "${c.name}" แล้ว`);
                    })
                  }
                >
                  {busy === `save-${c.key}` ? 'กำลังบันทึก…' : 'บันทึก'}
                </Button>
                {isNew ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConns((cur) => cur.filter((x) => x.key !== c.key))}>
                    ยกเลิก
                  </Button>
                ) : confirmDelete === c.key ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy === `del-${c.key}`}
                      onClick={() =>
                        void run(`del-${c.key}`, async () => {
                          apply(await deleteAiConnection(c.key));
                          setConfirmDelete(null);
                          setNotice(`ลบ "${c.name}" แล้ว · งานที่ใช้อยู่กลับไปใช้ ${envLabel}`);
                        })
                      }
                    >
                      ยืนยันลบ
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                      ไม่ลบ
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(c.key)}>
                    <Trash2 aria-hidden /> ลบ
                  </Button>
                )}
                <TestLine r={tests[c.key]} />
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default AiSettingsTab;
