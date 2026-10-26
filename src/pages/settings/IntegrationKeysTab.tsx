/**
 * ═══ ตั้งค่า › เชื่อมระบบภายนอก (เจ้าของ 22 ต.ค. 2569 "ทุกอย่างต้องทำผ่าน UI ได้นะ") ═══
 * ออก key ใหม่ · ยกเลิก key · ดูใช้ล่าสุด · ก๊อปเส้นเชื่อม · ยอดคอมเมนต์ที่ So Scraping ส่งมา
 * key จริงขึ้นครั้งเดียวหลังออก (ฐานเก็บแค่ sha256) · ออกใหม่ = ตัวเก่าใช้ไม่ได้ทันที (ยืนยันก่อน)
 * 🔴 shadcn Card/Button/Badge/AlertDialog · สีจาก TONE · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiFetch } from '@/lib/apiFetch';
import { formatDateTimeTh } from '@/lib/dateTh';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { IntegrationName } from '@/lib/integrationKeys';
import LumosOldIdRepushCard from './LumosOldIdRepushCard';
import SoScrapingKeyCard from './SoScrapingKeyCard';

type KeyRow = { name: string; created_at: string; revoked_at: string | null; last_used_at: string | null } | null;
type Item = { name: IntegrationName; label: string; endpoints: readonly string[]; key: KeyRow };
type Stats = { total: number; with_phone: number; applications: number; last_at: string | null } | null;

const NUM = new Intl.NumberFormat('th-TH');

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const IntegrationKeysTab: React.FC = () => {
  const [items, setItems] = useState<Item[] | null>(null);
  const [stats, setStats] = useState<Stats>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: 'issue' | 'revoke'; item: Item } | null>(null);
  const [shownKey, setShownKey] = useState<{ name: string; key: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await apiFetch('/api/integration-keys');
      if (!r.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      const body = (await r.json()) as { items: Item[]; soScraping: Stats };
      setItems(body.items);
      setStats(body.soScraping);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { kind, item } = confirm;
      const r =
        kind === 'issue'
          ? await apiFetch('/api/integration-keys', { method: 'POST', body: JSON.stringify({ name: item.name }) })
          : await apiFetch(`/api/integration-keys?name=${encodeURIComponent(item.name)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(kind === 'issue' ? 'ออก key ไม่สำเร็จ' : 'ยกเลิก key ไม่สำเร็จ');
      if (kind === 'issue') {
        const body = (await r.json()) as { name: string; key: string };
        setShownKey(body);
      } else {
        setShownKey(null);
        setNotice(`ยกเลิก key ของ ${item.label} แล้ว`);
      }
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const copyAndSay = async (text: string, what: string) => setNotice((await copy(text)) ? `ก๊อปปี้${what}แล้ว` : 'ก๊อปปี้ไม่ได้ — เลือกข้อความแล้วก๊อปเอง');

  return (
    <div className="space-y-4" data-testid="integration-keys">
      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      {(items ?? []).map((item) => {
        const k = item.key;
        const status = !k ? 'ยังไม่ออก key' : k.revoked_at ? 'ยกเลิกแล้ว' : 'ใช้งานอยู่';
        return (
          <Card key={item.name} variant="solid" className="space-y-4 p-5" data-testid={`integration-${item.name}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-lg font-medium text-foreground">
                <KeyRound className="h-5 w-5 text-muted-foreground" aria-hidden />
                {item.label}
                <Badge variant={status === 'ใช้งานอยู่' ? 'default' : 'secondary'} data-testid="integration-status">
                  {status}
                </Badge>
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => setConfirm({ kind: 'issue', item })} data-testid="integration-issue">
                  ออก key ใหม่
                </Button>
                {k && !k.revoked_at ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setConfirm({ kind: 'revoke', item })} data-testid="integration-revoke">
                    ยกเลิก key
                  </Button>
                ) : null}
              </div>
            </div>

            {shownKey?.name === item.name ? (
              <div className={cn('space-y-2 rounded-xl border p-3', TONE.warn.soft)} data-testid="integration-new-key">
                <p className="text-sm font-medium text-foreground">key ใหม่ · ขึ้นครั้งเดียว</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="break-all rounded-lg bg-card px-2 py-1 text-sm text-foreground">{shownKey.key}</code>
                  <Button type="button" size="sm" variant="outline" onClick={() => void copyAndSay(shownKey.key, ' key')}>
                    <Copy aria-hidden /> ก๊อปปี้ key
                  </Button>
                </div>
              </div>
            ) : null}

            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">ออก key เมื่อ</dt>
                <dd className="tabular-nums text-foreground">{k ? formatDateTimeTh(k.created_at) : '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">ใช้ล่าสุด</dt>
                <dd className="tabular-nums text-foreground" data-testid="integration-last-used">
                  {k?.last_used_at ? formatDateTimeTh(k.last_used_at) : '—'}
                </dd>
              </div>
            </dl>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">เส้นเชื่อม (header x-api-key)</p>
              {item.endpoints.map((p) => {
                const url = `${window.location.origin}${p}`;
                return (
                  <div key={p} className="flex flex-wrap items-center gap-2">
                    <code className="break-all rounded-lg bg-muted px-2 py-1 text-xs text-foreground">POST {url}</code>
                    <Button type="button" size="sm" variant="ghost" onClick={() => void copyAndSay(url, 'เส้นเชื่อม')}>
                      <Copy aria-hidden /> ก๊อปปี้
                    </Button>
                  </div>
                );
              })}
            </div>

            {item.name === 'so-scraping' ? (
              <div className="space-y-1" data-testid="integration-stats">
                <p className="text-xs font-medium text-muted-foreground">คอมเมนต์ที่ส่งมา (คน)</p>
                <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums text-foreground">
                  <span>ทั้งหมด {NUM.format(stats?.total ?? 0)}</span>
                  <span>มีเบอร์ {NUM.format(stats?.with_phone ?? 0)}</span>
                  <span>ไม่มีเบอร์ {NUM.format((stats?.total ?? 0) - (stats?.with_phone ?? 0))}</span>
                  <span>เข้าหน้าผู้สมัคร {NUM.format(stats?.applications ?? 0)}</span>
                  <span className="text-muted-foreground">ล่าสุด {stats?.last_at ? formatDateTimeTh(stats.last_at) : '—'}</span>
                </p>
              </div>
            ) : null}
          </Card>
        );
      })}

      {/* key ที่ So Scraping ออกให้ Jarvis เรียกตัวเลือกตอนสั่งงาน (26 ต.ค. 2569) */}
      <SoScrapingKeyCard />

      {/* แผนติดตามรหัสเดิมที่ค้างที่ Lumos (22 ต.ค. 2569) */}
      <LumosOldIdRepushCard />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'issue' ? `ออก key ใหม่ให้ ${confirm.item.label}?` : `ยกเลิก key ของ ${confirm?.item.label}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'issue' ? 'key เดิมใช้ไม่ได้ทันที ต้องเอา key ใหม่ไปตั้งที่ระบบนั้น' : 'ระบบนั้นส่งข้อมูลเข้ามาไม่ได้จนกว่าจะออก key ใหม่'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>ไม่ทำ</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void run();
              }}
              data-testid="integration-confirm"
            >
              {confirm?.kind === 'issue' ? 'ออก key ใหม่' : 'ยกเลิก key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default IntegrationKeysTab;
