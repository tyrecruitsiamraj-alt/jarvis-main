import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, LoaderCircle, Plus, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { useAuth } from '@/contexts/AuthContext';
import {
  createFollowTopic,
  listFollowTopicsCached,
  type FollowTopic,
} from '@/lib/followTopicsApi';

/**
 * กล่องจัดการ "เรื่องที่จะให้โทรติดตาม" บนหน้า Follow (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-4:
 * *"ข้อมูลใน dropdown สร้างตัวเพิ่มข้อมูลไว้ในหน้า Follow นั่นแหละ"*)
 *
 * เดิมเพิ่มเรื่องได้จากลิงก์เล็ก ๆ ในตัว dropdown เท่านั้น — ย้ายมาเป็นกล่องบนหน้าให้เห็นชัด
 * โชว์เรื่องที่มีทั้งหมด (ทุกคนเห็น) · เพิ่มเรื่องใหม่เฉพาะ supervisor ขึ้นไป (server กันอีกชั้น)
 *
 * 🔴 เพิ่มเรื่องแล้ว **ต้องบอกให้ dropdown ในฟอร์มโหลดลิสต์ใหม่** ผ่าน `onChanged`
 * ไม่งั้นเรื่องที่เพิ่งเพิ่มจะไม่โผล่จนกว่าจะรีเฟรชหน้า (createFollowTopic ล้างแคชให้แล้ว
 * · onChanged แค่ bump ตัวนับให้ FollowMasterSelect รู้ว่าต้องโหลดซ้ำ)
 */
export default function TopicManager({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth();
  const canAdd = user?.role === 'supervisor' || user?.role === 'admin';

  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<FollowTopic[]>([]);
  /** null = ยังไม่โหลด · false = โหลดพัง */
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // โหลดตอนกางกล่องครั้งแรกเท่านั้น — ไม่กางก็ไม่ต้องยิงเส้น
  useEffect(() => {
    if (!open || loaded !== null) return;
    let cancelled = false;
    void listFollowTopicsCached()
      .then((v) => {
        if (!cancelled) {
          setTopics(v);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const created = await createFollowTopic(trimmed);
      setTopics((prev) =>
        [...prev, created].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'th')),
      );
      setName('');
      setOkMsg(`เพิ่ม "${created.name}" แล้ว`);
      onChanged?.();
      window.setTimeout(() => setOkMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่มไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('rounded-2xl border', TONE.neutral.soft)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
          <Tags className="h-3.5 w-3.5" aria-hidden />
          เรื่องที่จะให้โทรติดตาม
          <span className="text-[11px] font-normal text-muted-foreground">
            (ตัวเลือกใน dropdown ตอนเพิ่มรายชื่อ)
          </span>
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="space-y-2.5 border-t border-border/60 px-4 py-3">
          {loaded === null ? (
            <p className="text-[11px] text-muted-foreground">กำลังโหลด…</p>
          ) : loaded === false ? (
            <p className="text-[11px] text-muted-foreground">
              โหลดไม่ได้ตอนนี้ — ยังพิมพ์เรื่องเองในฟอร์มได้ตามปกติ
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {topics.length > 0 ? (
                topics.map((t) => (
                  <span key={t.id} className="jarvis-chip jarvis-chip-neutral">
                    {t.name}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-muted-foreground">ยังไม่มีเรื่องในลิสต์</span>
              )}
            </div>
          )}

          {canAdd ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  // Enter = เพิ่ม (กล่องนี้ไม่ได้อยู่ใน <form> จึงไม่ยิง submit หน้าอื่น)
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void add();
                  }
                }}
                placeholder="เพิ่มเรื่องใหม่ เช่น ติดตามเบิกเบี้ยเลี้ยง"
                maxLength={120}
                className="jarvis-soft-field min-h-[40px] flex-1"
              />
              <button
                type="button"
                onClick={() => void add()}
                disabled={busy || !name.trim()}
                className={cn(
                  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 text-xs font-semibold disabled:opacity-50',
                  TONE.info.outline,
                )}
              >
                {busy ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                )}
                เพิ่มเรื่อง
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              เพิ่มเรื่องใหม่ได้เฉพาะหัวหน้างานขึ้นไป
            </p>
          )}

          {error ? (
            <p className={cn('rounded-lg px-2 py-1 text-[11px]', TONE.danger.soft, TONE.danger.value)}>
              {error}
            </p>
          ) : null}
          {okMsg ? (
            <p className={cn('rounded-lg px-2 py-1 text-[11px]', TONE.success.soft, TONE.success.value)}>
              {okMsg}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
