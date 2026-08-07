import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import {
  fetchLumosDispatchMode,
  saveLumosDispatchMode,
} from '@/lib/lumosDispatchModeApi';
import {
  DEFAULT_LUMOS_DISPATCH_MODE,
  LUMOS_DISPATCH_TRIGGERS,
  modesForTrigger,
  LUMOS_MODE_LABEL,
  LUMOS_TRIGGER_DETAIL,
  LUMOS_TRIGGER_LABEL,
  type LumosDispatchMode,
  type LumosDispatchModeConfig,
} from '@/lib/lumosDispatchMode';
import { Loader2 } from 'lucide-react';

/**
 * ตั้งค่า "โหมดส่งงานให้ Lumos" — เปิด/ปิด auto-send ต่อจุด
 *
 * เดิม auto-send ถูก hardcode 3 จุดในโค้ด เจ้าของสั่งปิดก่อนแต่จะเอากลับมาวันหน้า
 * หน้านี้ทำให้เปลี่ยนไป Auto = กดสวิตช์ ไม่ต้องแก้โค้ด ไม่ต้อง deploy
 */
const LumosDispatchModeTab: React.FC = () => {
  const [config, setConfig] = useState<LumosDispatchModeConfig>(DEFAULT_LUMOS_DISPATCH_MODE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    void fetchLumosDispatchMode().then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  const pick = (trigger: keyof LumosDispatchModeConfig, mode: LumosDispatchMode) => {
    setConfig((prev) => ({ ...prev, [trigger]: mode }));
    setSavedAt(null);
    setError(null);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveLumosDispatchMode(config);
      setConfig(saved);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const autoCount = LUMOS_DISPATCH_TRIGGERS.filter((t) => config[t] === 'auto').length;
  const assistCount = LUMOS_DISPATCH_TRIGGERS.filter((t) => config[t] === 'assist').length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className={cn('text-base font-semibold', DASH.cellStrong)}>โหมดส่งงานให้ Lumos</h2>
        <p className={cn('mt-1 text-xs', DASH.muted)}>
          เลือกว่าแต่ละจุดจะให้ระบบส่งเข้าคิวโทรเองทันที หรือให้คนติ๊กเลือกแล้วกดส่ง —
          เปลี่ยนที่นี่มีผลทันที ไม่ต้อง deploy
        </p>
      </div>

      <div
        className={cn(
          'rounded-xl border px-3 py-2 text-xs',
          autoCount === 0 ? cn(TONE.neutral.soft, TONE.neutral.value) : cn(TONE.warn.soft, TONE.warn.value),
        )}
      >
        {autoCount === 0
          ? assistCount === 0
            ? 'ตอนนี้ปิด auto ทุกจุด — ระบบจะไม่โทรหาใครเองจนกว่าจะมีคนกดส่ง'
            : `ระบบจัดชุดให้ ${assistCount} จุด — ยังไม่โทรจนกว่าจะมีคนอนุมัติที่หน้า Follow`
          : `เปิด auto อยู่ ${autoCount} จุด — ระบบจะโทรหาผู้สมัครเองเมื่อถึงจุดนั้น`}
      </div>

      {loading ? (
        <p className={cn('text-sm', DASH.muted)}>กำลังโหลด…</p>
      ) : (
        <div className="space-y-2.5">
          {LUMOS_DISPATCH_TRIGGERS.map((trigger) => (
            <div key={trigger} className={cn('rounded-xl border p-3', DASH.card)}>
              <p className={cn('text-sm font-semibold', DASH.cellStrong)}>
                {LUMOS_TRIGGER_LABEL[trigger]}
              </p>
              <p className={cn('mt-0.5 text-[11px] leading-relaxed', DASH.muted)}>
                {LUMOS_TRIGGER_DETAIL[trigger]}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {modesForTrigger(trigger).map((mode) => {
                  const active = config[trigger] === mode;
                  const tone =
                    mode === 'auto' ? TONE.warn : mode === 'assist' ? TONE.info : TONE.neutral;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => pick(trigger, mode)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                        tone.soft,
                        tone.value,
                        active ? 'ring-2 ring-ring' : tone.softHover,
                      )}
                    >
                      {LUMOS_MODE_LABEL[mode]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? <p className={cn('text-xs', TONE.danger.value)}>{error}</p> : null}
      {savedAt ? (
        <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.success.soft, TONE.success.value)}>
          บันทึกแล้ว — มีผลกับการส่งครั้งถัดไปทันที
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || loading}
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60',
          TONE.primary.solid,
        )}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {saving ? 'กำลังบันทึก…' : 'บันทึกโหมด'}
      </button>

      <p className={cn('text-[11px] leading-relaxed', DASH.muted)}>
        <b>ระบบจัดชุด คนอนุมัติ</b> = ระบบรวมคนที่ AI แนะนำเป็น "ชุดรออนุมัติ" ไปโผล่ที่หน้า Follow
        กดอนุมัติทีเดียวแล้วยังถอนคำได้อีก 10 นาทีก่อนโทรจริง ·
        มีเฉพาะจุดที่ระบบเป็นคนเริ่ม — รายการติดตามที่คนกรอกเองถือว่าอนุมัติแล้วในตัว
      </p>
    </div>
  );
};

export default LumosDispatchModeTab;
