import React, { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, PhoneOff, RotateCcw } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatDateTimeTh } from '@/lib/dateTh';

/**
 * **บัญชีห้ามโทร** — ดูว่าเบอร์ไหนถูกพักอยู่ และปลดได้
 *
 * เจ้าของถาม 1 ก.ย. 2569 ว่าคำว่า *"ไม่ได้ส่ง — เบอร์อยู่ในบัญชีห้ามโทร"* คืออะไร
 * แล้วพบว่า **ไม่มีที่ไหนดูหรือปลดได้เลย** ทำได้แค่รอหมดอายุ
 *
 * ⚠️ ปลดแล้วมีผลกับ **สายที่สร้างใหม่** เท่านั้น — สายเก่าที่เคยถูกปฏิเสธไปแล้ว
 * ไม่เคยเข้าคิว จะไม่ถูกส่งย้อนหลังให้เอง ต้องตั้งรอบใหม่
 */

type Item = {
  phone: string;
  until: string | null;
  reason: string | null;
  reason_label: string;
  note: string | null;
  created_at: string | null;
};

const CallSuppressionTab: React.FC = () => {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await apiFetch('/api/call-suppression');
      if (!r.ok) throw new Error('โหลดบัญชีห้ามโทรไม่สำเร็จ');
      const body = (await r.json()) as { items: Item[] };
      setItems(body.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดบัญชีห้ามโทรไม่สำเร็จ');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const release = async (phone: string) => {
    setBusy(phone);
    setError(null);
    setNotice(null);
    try {
      const r = await apiFetch(`/api/call-suppression?phone=${encodeURIComponent(phone)}`, {
        method: 'DELETE',
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message || 'ปลดเบอร์ไม่สำเร็จ');
      }
      setNotice(`ปลด ${phone} แล้ว — สายที่สร้างใหม่หลังจากนี้ส่งให้ AI ได้ (สายเก่าต้องตั้งรอบใหม่)`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ปลดเบอร์ไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">บัญชีห้ามโทร</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          เบอร์ที่ AI จะ <b>ไม่โทรถึงชั่วคราว</b> — ระบบพักให้เองเมื่อผลโทรกลับมาว่า
          &ldquo;เบอร์ผิด&rdquo; (7 วัน) หรือ &ldquo;ไม่หางานแล้ว&rdquo; (30 วัน) ·
          รายการที่พ้นกำหนดแล้วไม่ต้องปลด ระบบเลิกบล็อกเอง
        </p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          ⚠️ ปลดแล้วมีผลกับสายที่ <b>สร้างใหม่</b> เท่านั้น — สายเก่าที่เคยถูกปฏิเสธไม่เคยเข้าคิว
          ต้องตั้งรอบโทรใหม่ให้คนนั้นอีกครั้ง
        </p>
      </div>

      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      {notice ? <p className={cn('text-sm', TONE.success.value)}>{notice}</p> : null}

      {items === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> กำลังโหลด…
        </p>
      ) : items.length === 0 ? (
        <div className={cn('rounded-xl border px-4 py-8 text-center', DASH.card)}>
          <PhoneOff className={cn('mx-auto h-7 w-7', DASH.muted)} aria-hidden />
          <p className="mt-2 text-sm font-medium text-foreground">ตอนนี้ไม่มีเบอร์ไหนถูกพัก</p>
          <p className={cn('mt-1 text-xs', DASH.muted)}>ทุกเบอร์ส่งให้ AI โทรได้ตามปกติ</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li
              key={it.phone}
              className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5', DASH.card)}
            >
              <span className="min-w-0">
                <b className="font-mono text-sm text-foreground">{it.phone}</b>
                <span className={cn('block text-xs', DASH.muted)}>
                  {it.reason_label}
                  {it.until ? ` · พักถึง ${formatDateTimeTh(it.until)}` : ''}
                </span>
              </span>
              <button
                type="button"
                disabled={busy === it.phone}
                onClick={() => void release(it.phone)}
                title="เอาเบอร์นี้ออกจากบัญชีห้ามโทร — AI จะโทรถึงได้อีกครั้ง"
                className={cn(
                  'inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-semibold disabled:opacity-50',
                  TONE.warn.outline,
                )}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {busy === it.phone ? 'กำลังปลด…' : 'ปลดเบอร์นี้'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CallSuppressionTab;
