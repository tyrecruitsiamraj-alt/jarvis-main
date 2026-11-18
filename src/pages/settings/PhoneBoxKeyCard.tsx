/**
 * ═══ ตั้งค่า › เชื่อมระบบภายนอก › กุญแจ phone-box (เจ้าของ 16 พ.ย. 2569) ═══
 * มือถือโพสต์กลุ่ม Facebook · เก็บกุญแจเข้ารหัสฝั่ง server จอเห็นแค่ 4 ตัวท้าย
 * ใส่กุญแจแล้วจอขึ้นสถานะเครื่อง + บัญชีที่ผูก + จำนวนกลุ่ม
 * ติ๊ก "ส่ง Autopost" (18 พ.ย. 2569) = Autopost ที่เลือกบัญชีนี้ส่งมา phone-box แทน So Scraping (RM009)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/apiFetch';
import { formatDateTimeTh } from '@/lib/dateTh';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

type View = { configured: boolean; hint: string | null; base_url: string; updated_by: string | null; updated_at: string | null };
type Device = {
  serial: string;
  accountId: string | null;
  accountName: string | null;
  online: boolean;
  adbState: string;
  facebookOpen: boolean | null;
  groups: number | null;
  groupsMapped: number | null;
};
type Route = { accountId: string; accountName: string; enabled: boolean };
type Status = { ok: true; status: string; onlineDevices: number; devices: Device[]; routes?: Route[] } | { ok: false; message: string };

const NAME = 'phone-box';
const NUM = new Intl.NumberFormat('th-TH');

async function errorText(r: Response, fallback: string): Promise<string> {
  const b = (await r.json().catch(() => null)) as { message?: string } | null;
  return b?.message || fallback;
}

const PhoneBoxKeyCard: React.FC = () => {
  const [view, setView] = useState<View | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<'save' | 'check' | 'clear' | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const check = useCallback(async (url: string, typed: string | null) => {
    setBusy('check');
    setError(null);
    setStatus(null);
    try {
      const r = await apiFetch('/api/integration-keys', {
        method: 'POST',
        body: JSON.stringify({ outbound: NAME, test: true, base_url: url, key: typed }),
      });
      if (!r.ok) throw new Error(await errorText(r, 'เช็กไม่สำเร็จ'));
      setStatus((await r.json()) as Status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เช็กไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch('/api/integration-keys');
      if (!r.ok) throw new Error(await errorText(r, 'โหลดข้อมูลไม่สำเร็จ'));
      const b = (await r.json()) as { outbound?: Record<string, View> };
      const v = b.outbound?.[NAME];
      if (!v) return;
      setView(v);
      setBaseUrl(v.base_url);
      if (v.configured) void check(v.base_url, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    }
  }, [check]);

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
        body: JSON.stringify({ outbound: NAME, base_url: baseUrl, key: clear ? null : key, clear }),
      });
      if (!r.ok) throw new Error(await errorText(r, 'บันทึกไม่สำเร็จ'));
      const b = (await r.json()) as { outbound: Record<string, View> };
      const v = b.outbound[NAME];
      setView(v);
      setBaseUrl(v.base_url);
      setKey('');
      setStatus(null);
      setNotice(clear ? 'ลบกุญแจแล้ว' : 'บันทึกแล้ว');
      setBusy(null);
      if (!clear) void check(v.base_url, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
      setBusy(null);
    }
  };

  const canCheck = Boolean(baseUrl.trim()) && (Boolean(key.trim()) || Boolean(view?.configured));
  const devices = status?.ok === true ? status.devices : [];
  const routes = status?.ok === true ? (status.routes ?? []) : [];
  const routed = (accountId: string | null) => Boolean(accountId && routes.some((r) => r.accountId === accountId && r.enabled));
  const [routeBusy, setRouteBusy] = useState<string | null>(null);
  const toggleRoute = async (d: Device, enabled: boolean) => {
    if (!d.accountId || routeBusy) return;
    setRouteBusy(d.accountId);
    setError(null);
    try {
      const r = await apiFetch('/api/integration-keys', {
        method: 'PUT',
        body: JSON.stringify({ outbound: NAME, route: { account_id: d.accountId, account_name: d.accountName ?? d.accountId, enabled } }),
      });
      if (!r.ok) throw new Error(await errorText(r, 'บันทึกไม่สำเร็จ'));
      const b = (await r.json()) as { routes: Route[] };
      setStatus((cur) => (cur?.ok === true ? { ...cur, routes: b.routes } : cur));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setRouteBusy(null);
    }
  };

  return (
    <Card variant="solid" className="space-y-4 p-5" data-testid="phone-box-key">
      <h3 className="flex flex-wrap items-center gap-2 text-lg font-medium text-foreground">
        <Smartphone className="h-5 w-5 text-muted-foreground" aria-hidden />
        กุญแจ phone-box
        <Badge variant={view?.configured ? 'default' : 'secondary'} data-testid="phone-box-status">
          {view?.configured ? `ใส่แล้ว ${view.hint ?? ''}`.trim() : 'ยังไม่ได้ใส่'}
        </Badge>
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone-box-url">URL</Label>
          <Input id="phone-box-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} disabled={!view} data-testid="phone-box-url" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone-box-key-input">{view?.configured ? 'กุญแจใหม่' : 'กุญแจ'}</Label>
          <Input
            id="phone-box-key-input"
            type="password"
            autoComplete="off"
            value={key}
            placeholder="วางกุญแจ phone-box"
            onChange={(e) => setKey(e.target.value)}
            disabled={!view}
            data-testid="phone-box-key-input"
          />
        </div>
      </div>

      {status?.ok === false ? (
        <p className={cn('text-sm', TONE.danger.value)} data-testid="phone-box-check">
          {status.message}
        </p>
      ) : null}
      {status?.ok === true ? (
        <div className="space-y-2" data-testid="phone-box-check">
          <p className="text-sm tabular-nums text-foreground">
            เครื่องหลัก {status.status} · ออนไลน์ {NUM.format(status.onlineDevices)} จาก {NUM.format(devices.length)} เครื่อง
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เครื่อง</TableHead>
                  <TableHead>บัญชี</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>Facebook</TableHead>
                  <TableHead className="text-right">กลุ่ม</TableHead>
                  <TableHead className="text-right">กลุ่มที่จับคู่แล้ว</TableHead>
                  <TableHead>ส่ง Autopost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      ไม่มีเครื่อง
                    </TableCell>
                  </TableRow>
                ) : (
                  devices.map((d) => (
                    <TableRow key={d.serial}>
                      <TableCell className="whitespace-nowrap">{d.serial}</TableCell>
                      <TableCell>{d.accountName ?? d.accountId ?? 'ยังไม่ผูกบัญชี'}</TableCell>
                      <TableCell className={cn('whitespace-nowrap', d.online ? TONE.success.value : TONE.danger.value)}>
                        {d.online ? 'ออนไลน์' : `ออฟไลน์ (${d.adbState})`}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{d.facebookOpen == null ? '—' : d.facebookOpen ? 'เปิดอยู่' : 'ไม่ได้เปิด'}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.groups == null ? '—' : NUM.format(d.groups)}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.groupsMapped == null ? '—' : NUM.format(d.groupsMapped)}</TableCell>
                      <TableCell>
                        {d.accountId ? (
                          <Checkbox
                            checked={routed(d.accountId)}
                            disabled={routeBusy !== null}
                            onCheckedChange={(v) => void toggleRoute(d, v === true)}
                            aria-label={`ส่ง Autopost ด้วย ${d.accountName ?? d.accountId}`}
                            data-testid={`phone-box-route-${d.accountId}`}
                          />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      {notice ? <p className={cn('text-sm', TONE.success.value)}>{notice}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canCheck || busy !== null}
          onClick={() => void check(baseUrl, key.trim() || null)}
          data-testid="phone-box-check-btn"
        >
          {busy === 'check' ? 'กำลังเช็ก…' : 'เช็กเครื่อง'}
        </Button>
        <Button type="button" size="sm" disabled={!view || !key.trim() || busy !== null} onClick={() => void save(false)} data-testid="phone-box-save">
          {busy === 'save' ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
        {view?.configured ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void save(true)} data-testid="phone-box-clear">
            ลบกุญแจ
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

export default PhoneBoxKeyCard;
