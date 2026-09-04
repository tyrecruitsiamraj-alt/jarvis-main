import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { DOCK_NAV_ITEMS } from '@/components/layout/bottom-nav/dockNavConfig';
import {
  applyNavPreferences,
  moveNavItem,
  renameNavItem,
  toggleNavItemHidden,
  type NavPreferences,
} from '@/lib/navPreferences';
import { fetchNavPreferences, saveNavPreferences } from '@/lib/navPreferencesApi';
import { NAV_PREFERENCES_CHANGED_EVENT } from '@/lib/navPreferencesEvent';
import { filterByMinimumRole } from '@/lib/rbac';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Eye, EyeOff, LoaderCircle, RotateCcw, Save } from 'lucide-react';

/**
 * จัดเมนูเอง — ย้ายลำดับ / เปลี่ยนชื่อ / ซ่อน
 * (เจ้าของสั่ง 16 ส.ค. 2569 เย็น: *"เพิ่มให้ฉันปรับแก้ ย้ายเอง เปลี่ยนชื่อเองได้ด้วย"*)
 *
 * ⚠️ "ซ่อน" ไม่ใช่การตัดสิทธิ์ — route ยังเข้าได้ด้วยลิงก์ตรง สิทธิ์จริงอยู่ที่แท็บ Roles
 * ⚠️ ตัวอย่างเมนูในหน้านี้ใช้ลิสต์ของ **admin** เสมอ (ไม่ตัดตาม role ผู้ดู) เพราะ
 * เป็นการตั้งค่าให้ทั้งระบบ ไม่ใช่ของตัวเอง
 */
const NavMenuTab: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [prefs, setPrefs] = useState<NavPreferences>({});
  const [saved, setSaved] = useState<NavPreferences>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetchNavPreferences().then((p) => {
      setPrefs(p);
      setSaved(p);
      setLoading(false);
    });
  }, []);

  const baseItems = useMemo(() => filterByMinimumRole(DOCK_NAV_ITEMS, 'admin'), []);
  const preview = useMemo(() => applyNavPreferences(baseItems, prefs), [baseItems, prefs]);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await saveNavPreferences(prefs);
      setPrefs(next);
      setSaved(next);
      // เมนูบนหน้าจอเปลี่ยนทันที ไม่ต้องรีเฟรช
      window.dispatchEvent(new Event(NAV_PREFERENCES_CHANGED_EVENT));
      setOkMessage('บันทึกแล้ว — เมนูเปลี่ยนทันที');
      window.setTimeout(() => setOkMessage(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" /> กำลังโหลดเมนู…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">จัดเมนู</h2>
        <p className="text-xs text-muted-foreground">
          ย้ายลำดับ เปลี่ยนชื่อ หรือซ่อนเมนูได้เอง · ซ่อนแล้วยังเข้าหน้านั้นได้ด้วยลิงก์ตรง
          (ถ้าจะตัดสิทธิ์จริงให้ไปที่แท็บ Roles)
        </p>
      </div>

      {!isAdmin ? (
        <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.warn.soft, TONE.warn.value)}>
          ดูได้อย่างเดียว — เฉพาะผู้ดูแลระบบเท่านั้นที่บันทึกได้
        </p>
      ) : null}

      <ul className="space-y-1.5">
        {preview.map((item, index) => {
          const o = prefs[item.path];
          return (
            <li
              key={item.path}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2"
            >
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {index + 1}.
              </span>
              <input
                value={o?.label ?? item.label}
                disabled={!isAdmin}
                onChange={(e) => setPrefs(renameNavItem(prefs, item.path, e.target.value))}
                aria-label={`ชื่อเมนูของ ${item.path}`}
                className="jarvis-soft-field min-h-[36px] w-40 text-sm"
              />
              <span className="font-mono text-[11px] text-muted-foreground">{item.path}</span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  disabled={!isAdmin || index === 0}
                  onClick={() => setPrefs(moveNavItem(baseItems, prefs, item.path, -1))}
                  aria-label="ย้ายขึ้น"
                  className={cn('rounded-lg border p-1.5 disabled:opacity-30', TONE.neutral.outline)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!isAdmin || index === preview.length - 1}
                  onClick={() => setPrefs(moveNavItem(baseItems, prefs, item.path, 1))}
                  aria-label="ย้ายลง"
                  className={cn('rounded-lg border p-1.5 disabled:opacity-30', TONE.neutral.outline)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setPrefs(toggleNavItemHidden(prefs, item.path))}
                  aria-label="ซ่อนเมนูนี้"
                  className={cn('rounded-lg border p-1.5 disabled:opacity-30', TONE.neutral.outline)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* เมนูที่ถูกซ่อน — ต้องเห็นเสมอ ไม่งั้นซ่อนแล้วหาทางเอากลับไม่เจอ */}
      {baseItems.filter((i) => prefs[i.path]?.hidden).length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">ซ่อนอยู่</p>
          {baseItems
            .filter((i) => prefs[i.path]?.hidden)
            .map((item) => (
              <div
                key={item.path}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border/70 px-3 py-2 text-muted-foreground"
              >
                <EyeOff className="h-3.5 w-3.5" />
                <span className="text-sm">{prefs[item.path]?.label ?? item.label}</span>
                <span className="font-mono text-[11px]">{item.path}</span>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setPrefs(toggleNavItemHidden(prefs, item.path))}
                  className={cn(
                    'ml-auto rounded-lg border px-2 py-1 text-xs font-semibold disabled:opacity-30',
                    TONE.neutral.outline,
                  )}
                >
                  เอากลับ
                </button>
              </div>
            ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {okMessage ? (
        <p className={cn('rounded-xl border px-3 py-2 text-sm', TONE.success.soft, TONE.success.value)}>
          {okMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm"
          type="button"
          disabled={!isAdmin || busy || !dirty}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5"
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <Save aria-hidden />}
          บันทึก
        </Button>
        <button
          type="button"
          disabled={!isAdmin || busy || !dirty}
          onClick={() => setPrefs(saved)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50',
            TONE.neutral.outline,
          )}
        >
          <RotateCcw className="h-4 w-4" /> ยกเลิกที่แก้
        </button>
        <button
          type="button"
          disabled={!isAdmin || busy || Object.keys(prefs).length === 0}
          onClick={() => setPrefs({})}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50',
            TONE.neutral.outline,
          )}
        >
          กลับเป็นค่าตั้งต้น
        </button>
      </div>
    </div>
  );
};

export default NavMenuTab;
