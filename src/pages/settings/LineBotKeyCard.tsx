/**
 * ═══ ตั้งค่า › เชื่อมระบบภายนอก › LINE Bot So Work (ทีมบอท 28 ต.ค. 2569 · เจ้าของ Choice "ทำข้อ 1–2") ═══
 * secret ร่วมกับบอท — ใช้ตรวจลิงก์สมัครจากบอท (lid/lsig) และเซ็นตอนแจ้งบอทว่าส่งใบสำเร็จ (`api/_lib/lineBotSoWork.ts`)
 * เก็บเข้ารหัสฝั่ง server · จอเห็นแค่ 4 ตัวท้าย · ยังไม่ใส่ = ไม่ตรวจ ไม่ส่งอะไรออกไป
 */
import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/apiFetch';
import { formatDateTimeTh } from '@/lib/dateTh';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

type View = { configured: boolean; hint: string | null; base_url: string; updated_by: string | null; updated_at: string | null };

const NAME = 'line-bot-sowork';

async function errorText(r: Response, fallback: string): Promise<string> {
  const b = (await r.json().catch(() => null)) as { message?: string } | null;
  return b?.message || fallback;
}

const LineBotKeyCard: React.FC = () => {
  const [view, setView] = useState<View | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState<'save' | 'clear' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = (v: View) => {
    setView(v);
    setBaseUrl(v.base_url);
  };

  const load = useCallback(async () => {
    try {
      const r = await apiFetch('/api/integration-keys');
      if (!r.ok) throw new Error(await errorText(r, 'โหลดข้อมูลไม่สำเร็จ'));
      const b = (await r.json()) as { outbound?: Record<string, View> };
      if (b.outbound?.[NAME]) apply(b.outbound[NAME]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (clear: boolean) => {
    if (busy) return;
    setBusy(clear ? 'clear' : 'save');
    setError(null);
    setNotice(null);
    try {
      const r = await apiFetch('/api/integration-keys', {
        method: 'PUT',
        body: JSON.stringify({ outbound: NAME, base_url: baseUrl, key: clear ? null : secret, clear }),
      });
      if (!r.ok) throw new Error(await errorText(r, 'บันทึกไม่สำเร็จ'));
      const b = (await r.json()) as { outbound: Record<string, View> };
      apply(b.outbound[NAME]);
      setSecret('');
      setNotice(clear ? 'ลบ secret แล้ว' : 'บันทึกแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card variant="solid" className="space-y-4 p-5" data-testid="line-bot-key">
      <h3 className="flex flex-wrap items-center gap-2 text-lg font-medium text-foreground">
        <MessageCircle className="h-5 w-5 text-muted-foreground" aria-hidden />
        LINE Bot So Work
        <Badge variant={view?.configured ? 'default' : 'secondary'} data-testid="line-bot-status">
          {view?.configured ? `ใส่ secret แล้ว ${view.hint ?? ''}`.trim() : 'ยังไม่ได้ใส่ secret'}
        </Badge>
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="line-bot-url">URL ของบอท</Label>
          <Input id="line-bot-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} disabled={!view} data-testid="line-bot-url" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="line-bot-secret">{view?.configured ? 'secret ใหม่' : 'secret'}</Label>
          <Input
            id="line-bot-secret"
            type="password"
            autoComplete="off"
            value={secret}
            placeholder="วาง secret ที่ทีมบอทส่งมา"
            onChange={(e) => setSecret(e.target.value)}
            disabled={!view}
            data-testid="line-bot-secret"
          />
        </div>
      </div>

      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      {notice ? <p className={cn('text-sm', TONE.success.value)}>{notice}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={!view || !secret.trim() || busy !== null} onClick={() => void save(false)} data-testid="line-bot-save">
          {busy === 'save' ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
        {view?.configured ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void save(true)} data-testid="line-bot-clear">
            ลบ secret
          </Button>
        ) : null}
        {view?.updated_at ? (
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            แก้ล่าสุด {formatDateTimeTh(view.updated_at)}
            {view.updated_by ? ` · ${view.updated_by}` : ''}
          </span>
        ) : null}
      </div>
    </Card>
  );
};

export default LineBotKeyCard;
