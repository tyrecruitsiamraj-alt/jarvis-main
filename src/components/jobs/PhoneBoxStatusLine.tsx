/**
 * ═══ สถานะที่ phone-box ของใบ Autopost ที่ส่งผ่านมือถือ (เจ้าของ 18 พ.ย. 2569) ═══
 * ปุ่ม "เช็กสถานะที่ phone-box" อ่าน GET /v1/posts/{id} ทีละกลุ่ม (อ่านอย่างเดียว) · คำบนจอจาก `phoneBoxStatusText`
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { fetchPhoneBoxStatus } from '@/lib/jobPostingRequestsApi';
import { phoneBoxStatusText } from '@/lib/phoneBoxPosts';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

type Item = Awaited<ReturnType<typeof fetchPhoneBoxStatus>>[number];

export default function PhoneBoxStatusLine({ orderId }: { orderId: string }) {
  const [items, setItems] = React.useState<Item[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const check = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setItems(await fetchPhoneBoxStatus(orderId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อ่านสถานะ phone-box ไม่ได้');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1" data-testid="phone-box-status-line">
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void check()}>
        {busy ? 'กำลังเช็ก…' : 'เช็กสถานะที่ phone-box'}
      </Button>
      {error ? <p className={cn('text-xs', TONE.danger.value)}>{error}</p> : null}
      {items ? (
        items.length === 0 ? (
          <p className="text-xs text-muted-foreground">ไม่มีเลขคำขอของ phone-box</p>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {items.map((it) => {
              const v = phoneBoxStatusText(it);
              return (
                <li key={it.postId}>
                  <span className="text-foreground">{it.groupName ?? it.postId}</span> ·{' '}
                  <span className={cn('font-medium', TONE[v.tone].value)}>{v.text}</span>
                  {it.reason ? <span className="text-muted-foreground"> · {it.reason}</span> : null}
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
