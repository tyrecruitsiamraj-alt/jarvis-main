/**
 * บรรทัดบอกว่า **รอบนี้ AI จะใช้บทไหน** — กางดูเนื้อบทได้
 *
 * เจ้าของสั่ง 1 ก.ย. 2569: *"หน้าติดตามฉันแก้บทแล้ว พาไปดูตอนเพิ่มคนที"*
 * (ก่อนหน้านั้นเคาะไว้แล้วว่า **แค่โชว์ให้เห็นว่ารอบไหนใช้บทไหน ไม่ต้องให้เลือก**)
 *
 * 🔴 **โชว์บทดิบตามที่เก็บไว้ ไม่ประกอบประโยคเอง** — ตัวประกอบจริงมีกฎเยอะ
 * (ตัวแปรไหนไม่มีค่า = ทิ้งทั้งบรรทัด · ต่อประโยครายได้ตอนเสิร์ฟคิว) ถ้าเขียนตัวประกอบ
 * ซ้ำฝั่งหน้าจอ วันหนึ่งสองที่จะไม่ตรงกัน แล้วจอจะโชว์คำที่ AI ไม่ได้พูดจริง
 * ⇒ โชว์บรรทัดตามที่แอดมินแก้ไว้เป๊ะ + บอกว่า {…} จะถูกเติมค่าจริงตอนโทร
 *
 * ⚠️ ระบบสลับบทให้เองตามรอบ (31 ส.ค. 2569) — รอบแรกใช้ชุด `follow`
 * รอบ 2 เป็นต้นไปใช้ `follow_repeat` · ที่นี่แค่สะท้อนกติกานั้น ห้ามตั้งกติกาใหม่
 */
import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { apiFetch } from '@/lib/apiFetch';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

type ScriptItem = { key: string; label: string; lines: string[] };

/** โหลดครั้งเดียวต่อหน้า แล้วแชร์กันทุกรอบ — ไม่ยิงซ้ำต่อรอบ */
let cache: Promise<ScriptItem[]> | null = null;

function loadScripts(): Promise<ScriptItem[]> {
  if (!cache) {
    cache = apiFetch('/api/call-scripts')
      .then((r) => (r.ok ? r.json() : { scripts: [] }))
      .then((b: { scripts?: ScriptItem[] }) => b.scripts ?? [])
      .catch(() => []);
  }
  return cache;
}

const RoundScriptNote: React.FC<{ roundIndex: number; className?: string }> = ({
  roundIndex,
  className,
}) => {
  const [scripts, setScripts] = useState<ScriptItem[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadScripts().then((s) => {
      if (!cancelled) setScripts(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // รอบแรกใช้บทหนึ่ง รอบถัด ๆ ไปใช้อีกบท — ตรงกับที่ระบบสลับให้ตอนส่งจริง
  const key = roundIndex === 0 ? 'follow' : 'follow_repeat';
  const item = scripts?.find((s) => s.key === key) ?? null;
  if (!scripts) return null;
  if (!item) return null;

  return (
    <div className={cn('rounded-lg border border-white/60 bg-white/40 px-2.5 py-1.5 dark:border-white/10 dark:bg-white/5', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className={cn('text-[11px]', DASH.muted)}>
          รอบนี้ AI ใช้บท <span className={cn('font-semibold', TONE.info.value)}>{item.label}</span>
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="mt-1.5 space-y-1 border-t border-white/60 pt-1.5 dark:border-white/10">
          {item.lines.map((line, i) => (
            <p key={`${i}-${line}`} className="text-[11px] leading-4 text-foreground">
              {line}
            </p>
          ))}
          <p className={cn('pt-0.5 text-[10px]', DASH.muted)}>
            คำใน {'{ }'} จะถูกเติมค่าจริงตอนโทร · แก้บทได้ที่หน้าตั้งค่า → บทพูดของ AI
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default RoundScriptNote;
