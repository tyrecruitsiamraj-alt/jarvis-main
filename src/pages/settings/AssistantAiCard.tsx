/**
 * ═══ กล่อง "ผู้ช่วย AI" บนสุดของ ตั้งค่า › AI ที่ใช้คิดงาน (เจ้าของ 13 พ.ย. 2569 "ตั้งไรเยอะแยะ knowa ตั้งนิดเดียว") ═══
 * แบบ KNOWA: ใส่กุญแจ OpenAI → ระบบดึงรุ่นจากบัญชีจริงให้เลือก → บันทึก จบในกล่องเดียว
 * เบื้องหลังใช้ของเดิม: การเชื่อมต่อชื่อ "OpenAI" (กุญแจเข้ารหัสในฐาน) + งาน `assistant_chat` · ไม่ฝังชื่อรุ่น
 */
import React, { useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldSelect } from '@/components/shared/FieldSelect';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { assistantChatModels, type AiSettingsView } from '@/lib/aiSettings';
import { listAiModels, saveAiConnection, saveAiRoutes } from '@/lib/aiSettingsApi';

const CONN_NAME = 'OpenAI';

export default function AssistantAiCard({ view, onSaved }: { view: AiSettingsView; onSaved: (v: AiSettingsView) => void }) {
  const route = view.routes.find((r) => r.task === 'assistant_chat');
  // การเชื่อมต่อที่ผู้ช่วยใช้อยู่ → ไม่มี = การเชื่อมต่อ OpenAI ตัวแรกที่มีกุญแจ (ใช้กุญแจเดิมได้ ไม่ต้องใส่ซ้ำ)
  const conn =
    view.connections.find((c) => c.id === route?.connection_id && c.kind === 'openai') ??
    view.connections.find((c) => c.kind === 'openai' && c.has_key) ??
    null;
  const [key, setKey] = useState('');
  const [models, setModels] = useState<string[] | null>(null);
  const [model, setModel] = useState(route?.model ?? '');
  const [busy, setBusy] = useState<'models' | 'save' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ready = Boolean(route?.connection_id && route.model && conn?.has_key);

  /** รุ่นจากบัญชีจริง — กุญแจใหม่ที่เพิ่งวาง หรือกุญแจที่บันทึกไว้แล้ว */
  const loadModels = async (newKey: string) => {
    if (!newKey && !conn?.has_key) return;
    setBusy('models');
    setMsg(null);
    try {
      const ids = newKey
        ? await listAiModels({ connection: { name: CONN_NAME, kind: 'openai', base_url: '', model: 'x', api_key: newKey } })
        : await listAiModels({ connection_id: conn!.id });
      setModels(assistantChatModels(ids));
    } catch (e) {
      setModels(null);
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'ดึงรายชื่อรุ่นไม่ได้' });
    } finally {
      setBusy(null);
    }
  };
  // มีกุญแจอยู่แล้ว = ดึงรุ่นให้เลยตอนเปิดหน้า
  useEffect(() => {
    if (conn?.has_key) void loadModels('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn?.id]);

  const options = useMemo(() => {
    const list = models ?? [];
    return (model && !list.includes(model) ? [model, ...list] : list).map((m) => ({ value: m, label: m }));
  }, [models, model]);

  const save = async () => {
    if (!model || (!key && !conn?.has_key)) return;
    setBusy('save');
    setMsg(null);
    try {
      const saved = await saveAiConnection({ id: conn?.id, name: conn?.name ?? CONN_NAME, kind: 'openai', base_url: conn?.base_url ?? '', model, ...(key ? { api_key: key } : {}) });
      const c = conn ? saved.connections.find((x) => x.id === conn.id) : saved.connections.find((x) => x.kind === 'openai' && x.name === CONN_NAME);
      if (!c) throw new Error('บันทึกกุญแจแล้วแต่หาการเชื่อมต่อไม่เจอ ลองโหลดหน้าใหม่');
      onSaved(await saveAiRoutes([{ task: 'assistant_chat', connection_id: c.id, model }]));
      setKey('');
      setMsg({ ok: true, text: 'บันทึกแล้ว ผู้ช่วยใช้ได้เลย' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={cn('space-y-3 rounded-2xl border p-4', DASH.card)} data-testid="assistant-ai-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-medium">ผู้ช่วย AI</h3>
        <span className={cn('text-sm', ready ? TONE.success.value : DASH.sub)}>{ready ? `ใช้งานอยู่ · ${route?.model}` : 'ยังไม่ได้ตั้ง'}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="assistant-ai-key">กุญแจ OpenAI</Label>
          <Input
            id="assistant-ai-key"
            type="password"
            autoComplete="off"
            value={key}
            placeholder={conn?.has_key ? `ใส่ไว้แล้ว ลงท้าย ${conn.key_hint ?? '••••'} (ใส่ใหม่ = เปลี่ยน)` : 'วางกุญแจ sk-…'}
            onChange={(e) => setKey(e.target.value.trim())}
            onBlur={() => key && void loadModels(key)}
            data-testid="assistant-ai-key"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assistant-ai-model">รุ่น</Label>
          <FieldSelect
            id="assistant-ai-model"
            value={model}
            onChange={setModel}
            placeholder={busy === 'models' ? 'กำลังดึงรายชื่อ…' : models ? 'เลือกรุ่น' : 'ใส่กุญแจก่อน'}
            options={options}
            ariaLabel="รุ่นของผู้ช่วย AI"
            testId="assistant-ai-model"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy !== null || !model || (!key && !conn?.has_key)} onClick={() => void save()} data-testid="assistant-ai-save">
          {busy === 'save' ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          บันทึก
        </Button>
        {msg ? (
          <span className={cn('text-sm', msg.ok ? TONE.success.value : TONE.danger.value)} role={msg.ok ? undefined : 'alert'}>
            {msg.text}
          </span>
        ) : null}
      </div>
    </section>
  );
}
