import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoaderCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import {
  DEFAULT_PRIORITY_CONFIG,
  PRIORITY_CRITERIA,
  PRIORITY_DATA_NOTE,
  PRIORITY_LABELS,
  type PriorityConfig,
  type PriorityCriterion,
} from '@/lib/candidatePriority';
import {
  fetchMatchPriorityState,
  resetMatchPriorityConfig,
  saveMatchPriorityConfig,
} from '@/lib/matchPriorityWeightsApi';

/**
 * ตั้งน้ำหนักเกณฑ์เรียงผู้สมัครหน้า Matching (Settings › น้ำหนักเรียงผู้สมัคร)
 *
 * เลขน้ำหนักไม่ต้องรวมกันได้ 100 — ระบบ normalize ตามเกณฑ์ที่ "มีข้อมูลจริง" ของผู้สมัครคนนั้น
 * จึงโชว์สัดส่วน % ที่คำนวณให้ดูข้าง ๆ กันเข้าใจผิดว่าเลขคือเปอร์เซ็นต์
 */
const MatchPriorityWeightsTab: React.FC<{
  /**
   * id เต็มของใบขอ (`siamraj-sql:` / `siamraj-pre:`) — ตั้งน้ำหนัก**เฉพาะใบนั้น**
   * ไม่ส่ง = แก้ **ค่ากลาง** ที่เป็น Default ของทุกใบ (พฤติกรรมเดิมของหน้า Settings)
   * เจ้าของสั่ง 17 ส.ค. 2569: *"ค่าที่ตั้งไว้ตั้งเป็น Default แล้วถ้าจะแก้ไขไรก็ไปแก้เอง"*
   */
  requestNo?: string;
}> = ({ requestNo }) => {
  const perRequest = Boolean(requestNo?.trim());
  const [config, setConfig] = useState<PriorityConfig>(DEFAULT_PRIORITY_CONFIG);
  const [defaultConfig, setDefaultConfig] = useState<PriorityConfig>(DEFAULT_PRIORITY_CONFIG);
  const [overridden, setOverridden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchMatchPriorityState(requestNo)
      .then((st) => {
        if (cancelled) return;
        setConfig(st.config);
        setDefaultConfig(st.defaultConfig);
        setOverridden(st.overridden);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestNo]);

  /** รีเซ็ตใบนี้กลับไปใช้ค่ากลาง — ค่ากลางเองรีเซ็ตไม่ได้ (ปุ่มจึงโผล่เฉพาะโหมดต่อใบ) */
  const resetToDefault = async () => {
    if (!requestNo?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await resetMatchPriorityConfig(requestNo);
      const st = await fetchMatchPriorityState(requestNo);
      setConfig(st.config);
      setDefaultConfig(st.defaultConfig);
      setOverridden(st.overridden);
      setSavedAt(new Date().toLocaleTimeString('th-TH', { timeStyle: 'short' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'รีเซ็ตไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const totalWeight = useMemo(
    () => PRIORITY_CRITERIA.reduce((sum, k) => sum + (config.weights[k] ?? 0), 0),
    [config.weights],
  );

  const setWeight = (key: PriorityCriterion, value: number) => {
    setSavedAt(null);
    setConfig((prev) => ({
      ...prev,
      weights: { ...prev.weights, [key]: Math.max(0, Math.min(100, Math.round(value))) },
    }));
  };

  const toggleHard = (key: PriorityCriterion) => {
    setSavedAt(null);
    setConfig((prev) => ({
      ...prev,
      hard: prev.hard.includes(key) ? prev.hard.filter((k) => k !== key) : [...prev.hard, key],
    }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveMatchPriorityConfig(config, requestNo);
      setConfig(saved);
      // บันทึกต่อใบสำเร็จ = ใบนี้กลายเป็น "ตั้งเอง" ทันที (ไม่ต้องรอโหลดรอบใหม่)
      if (perRequest) setOverridden(true);
      setSavedAt(new Date().toLocaleTimeString('th-TH', { timeStyle: 'short' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" aria-hidden />
        กำลังโหลดค่าที่ตั้งไว้…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* โหมดต่อใบ — ต้องบอกให้ชัดว่ากำลังแก้ของใบเดียว ไม่ใช่ค่ากลางของทุกใบ
          ไม่บอก = คนเข้าใจผิดว่าแก้ทั้งระบบ (หรือกลับกัน) แล้วลำดับผู้สมัครเพี้ยนทั้งบอร์ด */}
      {perRequest ? (
        <div
          className={cn(
            'rounded-3xl border p-3 text-xs',
            overridden ? TONE.primary.soft : TONE.neutral.soft,
          )}
        >
          <p className="font-semibold text-foreground">
            {overridden ? 'ใบนี้ตั้งน้ำหนักเองไว้' : 'ใบนี้ยังใช้ค่ากลาง'}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            แก้ที่นี่มีผล <b className="text-foreground">เฉพาะใบขอนี้</b> ·{' '}
            ค่ากลางของทุกใบตั้งที่ Settings › น้ำหนักเรียงผู้สมัคร
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            ค่ากลางตอนนี้:{' '}
            {PRIORITY_CRITERIA.map((k) => `${PRIORITY_LABELS[k]} ${defaultConfig.weights[k] ?? 0}`).join(' · ')}
          </p>
          {overridden ? (
            <button
              type="button"
              onClick={() => void resetToDefault()}
              disabled={saving}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold hover:bg-secondary disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              กลับไปใช้ค่ากลาง
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="glass-card rounded-3xl border border-white/70 p-4 text-sm text-muted-foreground dark:border-slate-700/70">
        <p>
          {perRequest
            ? 'หน้า Matching เรียงผู้สมัครในใบขอนี้จากเกณฑ์ข้างล่างนี้ — ยิ่งน้ำหนักมาก ยิ่งมีผลต่อลำดับมาก'
            : 'หน้า Matching เรียงผู้สมัครในใบขอจากเกณฑ์ข้างล่างนี้ — ยิ่งน้ำหนักมาก ยิ่งมีผลต่อลำดับมาก'}
        </p>
        <p className="mt-1 text-xs">
          ไม่ต้องรวมกันได้ 100 · ระบบคิดสัดส่วนเฉพาะเกณฑ์ที่ผู้สมัครคนนั้น "มีข้อมูลจริง"
          คนที่ข้อมูลไม่ครบจึงไม่ถูกลงโทษ · ติ๊ก <b className="text-foreground">เกณฑ์แข็ง</b>{' '}
          = ไม่ผ่านข้อนี้แล้วตกไปท้ายลิสต์เลย (ไม่ใช่แค่คะแนนลด)
        </p>
      </div>

      <div className="space-y-2">
        {PRIORITY_CRITERIA.map((key) => {
          const weight = config.weights[key] ?? 0;
          const share = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
          const isHard = config.hard.includes(key);
          const note = PRIORITY_DATA_NOTE[key];
          return (
            <div
              key={key}
              className="glass-card rounded-2xl border border-white/70 p-3 dark:border-slate-700/70"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-foreground">{PRIORITY_LABELS[key]}</span>
                  {isHard ? (
                    <span className={cn(TONE.danger.chip, 'ml-2')}>เกณฑ์แข็ง</span>
                  ) : (
                    <span className={cn(TONE.neutral.chip, 'ml-2')}>ยืดหยุ่นได้</span>
                  )}
                </div>
                <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={isHard}
                    onChange={() => toggleHard(key)}
                  />
                  ไม่ผ่าน = ตกท้ายลิสต์
                </label>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={weight}
                  onChange={(e) => setWeight(key, Number(e.target.value))}
                  aria-label={`น้ำหนักของ ${PRIORITY_LABELS[key]}`}
                  className="h-1.5 flex-1 cursor-pointer accent-blue-600"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={weight}
                  onChange={(e) => setWeight(key, Number(e.target.value))}
                  aria-label={`น้ำหนักตัวเลขของ ${PRIORITY_LABELS[key]}`}
                  className="jarvis-soft-field w-[72px] text-center text-sm"
                />
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {share}%
                </span>
              </div>

              {note ? (
                <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {note}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm"
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex min-h-[42px] items-center gap-1.5 px-5 py-2 text-sm"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          บันทึกน้ำหนัก
        </Button>
        <button
          type="button"
          onClick={() => {
            setSavedAt(null);
            setConfig(DEFAULT_PRIORITY_CONFIG);
          }}
          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full border border-slate-300 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          คืนค่าเริ่มต้น
        </button>
        {savedAt ? (
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            บันทึกแล้ว {savedAt} — หน้า Matching ใช้ค่าใหม่ทันทีเมื่อโหลดใบขอถัดไป
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default MatchPriorityWeightsTab;
