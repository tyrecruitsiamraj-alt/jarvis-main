/**
 * ═══ ตั้งค่า › เชื่อมระบบภายนอก › key จาก So Scraping (เจ้าของ 26 ต.ค. 2569 "ทำเลย ตามเอกสาร") ═══
 * key ที่ทีม So Scraping ออกให้ Jarvis เรียก options API (บัญชี · กลุ่ม · เครื่อง · บัญชี JobThai/JobBKK)
 * เก็บแบบเข้ารหัสฝั่ง server · จอไม่เคยได้ key กลับ เห็นแค่ 4 ตัวท้าย · ทดสอบได้ก่อนบันทึก
 * ยังไม่ใส่ key = ป๊อป Autopost อ่านจากฐานของ So Scraping แบบเดิม
 */
import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
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
type TestResult = { ok: true; accounts: number; groups: number; workers: number; scrape_accounts: number } | { ok: false; message: string };

const NAME = 'so-scraping';
const NUM = new Intl.NumberFormat('th-TH');

async function errorText(r: Response, fallback: string): Promise<string> {
  const b = (await r.json().catch(() => null)) as { message?: string } | null;
  return b?.message || fallback;
}

const SoScrapingKeyCard: React.FC = () => {
  const [view, setView] = useState<View | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | 'clear' | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
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

  const reset = () => {
    setError(null);
    setNotice(null);
  };

  const save = async (clear: boolean) => {
    if (busy) return;
    setBusy(clear ? 'clear' : 'save');
    reset();
    try {
      const r = await apiFetch('/api/integration-keys', {
        method: 'PUT',
        body: JSON.stringify({ outbound: NAME, base_url: baseUrl, key: clear ? null : key, clear }),
      });
      if (!r.ok) throw new Error(await errorText(r, 'บันทึกไม่สำเร็จ'));
      const b = (await r.json()) as { outbound: Record<string, View> };
      apply(b.outbound[NAME]);
      setKey('');
      setTest(null);
      setNotice(clear ? 'ลบ key แล้ว' : 'บันทึกแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    if (busy) return;
    setBusy('test');
    reset();
    setTest(null);
    try {
      const r = await apiFetch('/api/integration-keys', {
        method: 'POST',
        body: JSON.stringify({ outbound: NAME, test: true, base_url: baseUrl, key: key || null }),
      });
      if (!r.ok) throw new Error(await errorText(r, 'ทดสอบไม่สำเร็จ'));
      setTest((await r.json()) as TestResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ทดสอบไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const canTest = Boolean(baseUrl.trim()) && (Boolean(key.trim()) || Boolean(view?.configured));

  return (
    <Card variant="solid" className="space-y-4 p-5" data-testid="so-outbound-key">
      <h3 className="flex flex-wrap items-center gap-2 text-lg font-medium text-foreground">
        <KeyRound className="h-5 w-5 text-muted-foreground" aria-hidden />
        key จาก So Scraping
        <Badge variant={view?.configured ? 'default' : 'secondary'} data-testid="so-outbound-status">
          {view?.configured ? `ใส่แล้ว ${view.hint ?? ''}`.trim() : 'ยังไม่ได้ใส่'}
        </Badge>
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="so-outbound-url">URL</Label>
          <Input
            id="so-outbound-url"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setTest(null);
            }}
            disabled={!view}
            data-testid="so-outbound-url"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="so-outbound-key">{view?.configured ? 'key ใหม่' : 'key'}</Label>
          <Input
            id="so-outbound-key"
            type="password"
            autoComplete="off"
            value={key}
            placeholder="วาง key ที่ทีม So Scraping ส่งมา"
            onChange={(e) => {
              setKey(e.target.value);
              setTest(null);
            }}
            disabled={!view}
            data-testid="so-outbound-key-input"
          />
        </div>
      </div>

      {test ? (
        test.ok === true ? (
          <p className={cn('text-sm tabular-nums', TONE.success.value)} data-testid="so-outbound-test">
            เชื่อมได้ · บัญชี Facebook {NUM.format(test.accounts)} · กลุ่ม {NUM.format(test.groups)} · เครื่อง {NUM.format(test.workers)} ·
            บัญชี JobThai/JobBKK {NUM.format(test.scrape_accounts)}
          </p>
        ) : (
          <p className={cn('text-sm', TONE.danger.value)} data-testid="so-outbound-test">
            {'message' in test ? test.message : null}
          </p>
        )
      ) : null}
      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      {notice ? <p className={cn('text-sm', TONE.success.value)}>{notice}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!canTest || busy !== null} onClick={() => void runTest()} data-testid="so-outbound-test-btn">
          {busy === 'test' ? 'กำลังทดสอบ…' : 'ทดสอบ'}
        </Button>
        <Button type="button" size="sm" disabled={!view || !key.trim() || busy !== null} onClick={() => void save(false)} data-testid="so-outbound-save">
          {busy === 'save' ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
        {view?.configured ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void save(true)} data-testid="so-outbound-clear">
            ลบ key
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

export default SoScrapingKeyCard;
