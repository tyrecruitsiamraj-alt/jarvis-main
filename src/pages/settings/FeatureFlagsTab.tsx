import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { FEATURES } from '@/lib/featureFlags';
import { useFeatureFlags, setFeatureEnabled } from '@/hooks/useFeatureFlags';

/**
 * เปิด/ปิดฟีเจอร์ระดับระบบ — คนละเรื่องกับแท็บ Roles (ใครใช้ได้บ้าง)
 * ปิดที่นี่ = ไม่มีใครเห็น ยกเว้น admin ที่ต้องทดสอบบนของจริง
 */
const FeatureFlagsTab: React.FC = () => {
  const { flags, refresh } = useFeatureFlags();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (featureId: string, next: boolean) => {
    setSavingId(featureId);
    setError(null);
    try {
      await setFeatureEnabled(featureId, next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">เปิด / ปิดฟีเจอร์</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          สวิตช์นี้ตอบว่า <span className="font-medium text-foreground">ฟีเจอร์เปิดใช้งานในระบบหรือยัง</span> ·
          ส่วน <span className="font-medium text-foreground">ใครใช้ได้บ้าง</span> กำหนดแยกที่แท็บ Roles
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ปิดไว้ = ทีมไม่เห็นเลย แต่ <span className="font-medium text-foreground">admin ยังเห็นเพื่อทดสอบ</span> ได้
        </p>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <ul className="space-y-2">
        {FEATURES.map((f) => {
          const enabled = flags?.[f.id] ?? true;
          const saving = savingId === f.id;
          return (
            <li
              key={f.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">{f.label}</span>
                  {!enabled ? (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                      ปิดอยู่ — เห็นเฉพาะ admin
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{f.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
                <Switch
                  checked={enabled}
                  disabled={saving}
                  onCheckedChange={(next) => void toggle(f.id, next)}
                  aria-label={`${f.label} — ${enabled ? 'เปิดอยู่' : 'ปิดอยู่'}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default FeatureFlagsTab;
