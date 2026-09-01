/**
 * แท็บ "บทพูดของ AI" — แก้บทที่ AI พูดตอนโทร แล้วมีผลกับสายใหม่ทันที
 * (เจ้าของสั่ง 27 ส.ค. 2569: *"ฉันแก้ Script การพูดจากฝั่งฉันแล้วให้มันส่งไป
 * พร้อมกันให้ Lumos เลย สร้างไว้หน้าตั้งค่าก็ได้"*)
 *
 * 🔴 กติกาบนจอ:
 * 1. แก้ทีละบรรทัด — หนึ่งช่อง = หนึ่งประโยคที่ AI พูด (รูปเดียวกับไฟล์บทเดิม)
 * 2. บันทึกแล้วบอกชัดว่า **มีผลกับสายที่เข้าคิวหลังจากนี้** — สายที่ค้างอยู่ถือบทเดิม
 * 3. ปุ่ม "คืนบทมาตรฐาน" ลบฉบับแก้ทิ้ง = ทางถอยที่ไม่ต้อง deploy
 * 4. ตัวแปร {ชื่อ} มีรายการแปะให้ กดแล้วต่อท้ายบรรทัดที่กำลังแก้ — พิมพ์เองผิด
 *    ตัวเดียวทั้งบรรทัดหายตอนโทรจริง (validate ฝั่ง server กันไว้อีกชั้น)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, Plus, RotateCcw, Trash2 } from 'lucide-react';

import { apiFetch } from '@/lib/apiFetch';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

type ScriptItem = {
  key: string;
  label: string;
  hint: string;
  lines: string[];
  default_lines: string[];
  overridden: boolean;
  updated_by: string | null;
  updated_at: string | null;
};

type ApiBody = {
  max_lines: number;
  placeholders: string[];
  scripts: ScriptItem[];
};

const CallScriptsTab: React.FC = () => {
  const [data, setData] = useState<ApiBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** บทที่กำลังแก้อยู่ในจอ — คีย์บท → บรรทัด (แยกจาก data เพื่อรู้ว่าแก้ค้างไหม) */
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await apiFetch('/api/call-scripts');
      if (!r.ok) throw new Error('โหลดบทไม่สำเร็จ');
      const body = (await r.json()) as ApiBody;
      setData(body);
      setDraft(Object.fromEntries(body.scripts.map((s) => [s.key, [...s.lines]])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดบทไม่สำเร็จ');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (key: string) => {
    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      const r = await apiFetch('/api/call-scripts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, lines: draft[key] }),
      });
      const body = (await r.json()) as { message?: string };
      if (!r.ok) throw new Error(body.message || 'บันทึกไม่สำเร็จ');
      setNotice('บันทึกแล้ว — สายที่เข้าคิวหลังจากนี้ใช้บทใหม่ทันที (สายที่ค้างคิวอยู่ยังใช้บทเดิม)');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusyKey(null);
    }
  };

  const restore = async (key: string) => {
    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      const r = await apiFetch(`/api/call-scripts?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (!r.ok) throw new Error('คืนบทมาตรฐานไม่สำเร็จ');
      setNotice('กลับไปใช้บทมาตรฐานแล้ว');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'คืนบทมาตรฐานไม่สำเร็จ');
    } finally {
      setBusyKey(null);
    }
  };

  const setLine = (key: string, i: number, value: string) =>
    setDraft((d) => ({ ...d, [key]: d[key].map((l, j) => (j === i ? value : l)) }));

  if (!data) {
    return error ? (
      <p className={cn('text-sm', TONE.danger.value)}>{error}</p>
    ) : (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> กำลังโหลดบท…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">บทพูดของ AI ตอนโทร</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          แก้แล้วกดบันทึก — <span className="font-medium">มีผลกับสายที่เข้าคิวหลังจากนี้ทันที</span>{' '}
          ไม่ต้องรอใคร deploy · สายที่ค้างคิวอยู่แล้วยังพูดบทเดิมของมัน ·
          คำในวงเล็บปีกกาเช่น {'{ชื่อผู้รับ}'} ระบบเติมค่าจริงให้ตอนโทร —
          บรรทัดไหนไม่มีข้อมูลของตัวแปร บรรทัดนั้นจะถูกข้ามไปเอง
        </p>
      </div>

      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      {notice ? <p className={cn('text-sm', TONE.success.value)}>{notice}</p> : null}

      {data.scripts.map((s) => {
        const lines = draft[s.key] ?? [];
        const dirty = JSON.stringify(lines) !== JSON.stringify(s.lines);
        const busy = busyKey === s.key;
        return (
          <section key={s.key} className={cn('rounded-xl border p-4', DASH.card)}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="text-sm font-semibold text-foreground">{s.label}</h3>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
              {s.overridden ? (
                <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold', TONE.info.chip)}>
                  ใช้ฉบับแก้อยู่{s.updated_by ? ` · แก้ล่าสุดโดย ${s.updated_by}` : ''}
                </span>
              ) : (
                <span className="ml-auto text-[10px] text-muted-foreground">ใช้บทมาตรฐานอยู่</span>
              )}
            </div>

            <ol className="mt-3 space-y-1.5">
              {lines.map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                    {i + 1}.
                  </span>
                  <textarea
                    value={line}
                    onChange={(e) => setLine(s.key, i, e.target.value)}
                    rows={Math.max(1, Math.ceil(line.length / 90))}
                    className="jarvis-soft-field min-h-[38px] w-full resize-y text-sm leading-relaxed"
                  />
                  <button
                    type="button"
                    title="ลบประโยคนี้"
                    onClick={() => setDraft((d) => ({ ...d, [s.key]: d[s.key].filter((_, j) => j !== i) }))}
                    className="mt-1.5 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ol>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={lines.length >= data.max_lines}
                onClick={() => setDraft((d) => ({ ...d, [s.key]: [...d[s.key], ''] }))}
                title={
                  lines.length >= data.max_lines
                    ? `เต็มเพดาน ${data.max_lines} ข้อแล้ว — Lumos รับได้จำกัด`
                    : 'เพิ่มประโยคต่อท้าย'
                }
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50',
                  TONE.neutral.outline,
                )}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> เพิ่มประโยค ({lines.length}/{data.max_lines})
              </button>
              <button
                type="button"
                disabled={busy || !dirty || lines.length === 0}
                onClick={() => void save(s.key)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50',
                  TONE.success.solid,
                )}
              >
                {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                บันทึกบทนี้
              </button>
              {s.overridden ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void restore(s.key)}
                  title="ลบฉบับแก้ทิ้ง กลับไปใช้บทมาตรฐานในระบบ"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50',
                    TONE.warn.outline,
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden /> คืนบทมาตรฐาน
                </button>
              ) : null}
              {/* 🔴 แก้ค้างแล้วต้องมี **ทางออกสองทาง** เสมอ (เจ้าของทัก 1 ก.ย. 2569:
                  *"บทพูดของ AI ตอนโทร แก้ค้างอยู่ ยังไม่ได้บันทึก แก้ไขที"*)
                  เดิมมีแต่คำเตือนลอย ๆ กับปุ่มบันทึก — ถ้าไม่อยากเอาที่แก้ ไม่มีปุ่มทิ้ง
                  ต้องรีเฟรชหน้าเอง และไม่มีอะไรบอกว่า "ของที่บันทึกไว้จริง ๆ คืออะไร" */}
              {dirty ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDraft((d) => ({ ...d, [s.key]: [...s.lines] }))}
                    title="ทิ้งข้อความที่พิมพ์ค้างไว้ แล้วดึงบทที่บันทึกไว้จริงกลับมาแสดง"
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50',
                      TONE.neutral.outline,
                    )}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden /> ทิ้งที่แก้ค้าง
                  </button>
                  <span className={cn('text-[11px]', TONE.warn.value)}>
                    แก้ค้างอยู่ ยังไม่ได้บันทึก — ข้อความในช่องต่างจากบทที่ใช้จริงตอนนี้
                  </span>
                </>
              ) : null}
            </div>
          </section>
        );
      })}

      <section className={cn('rounded-xl border p-4', DASH.card)}>
        <h3 className="text-xs font-semibold text-foreground">ตัวแปรที่ใช้ได้ในบท</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          พิมพ์ในวงเล็บปีกกา ระบบเติมค่าจริงให้ตอนโทร · พิมพ์ชื่อผิดระบบจะไม่ยอมบันทึก
          · ห้ามพิมพ์ตัวเลขเงินเอง — ใช้ {'{รายได้ต่อเดือน}'} ระบบจะเติมเลขที่ถูกต้องของใบขอนั้น
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.placeholders.map((ph) => (
            <code
              key={ph}
              className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground"
            >
              {'{' + ph + '}'}
            </code>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CallScriptsTab;
