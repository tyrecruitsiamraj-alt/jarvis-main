import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import { Copy, Globe, RefreshCw, ShieldAlert } from 'lucide-react';
import { isDemoMode } from '@/lib/demoMode';

export type OutboundIpCheck = {
  checkedAt: string;
  runtime: {
    nodeEnv: string | null;
    vercel: boolean;
    region: string | null;
    url: string | null;
    deploymentId: string | null;
  };
  outbound: {
    ips: string[];
    sources: { service: string; ip: string | null; ok: boolean; error?: string }[];
  };
  targets: {
    postgres: {
      configured: boolean;
      host: string | null;
      reachable: boolean | null;
      error: string | null;
    };
    mssql: {
      configured: boolean;
      host: string | null;
      port: number | null;
      database: string | null;
      reachable: boolean | null;
      error: string | null;
    };
  };
  firewallHint: string;
};

const LOG_KEY = 'jarvis_outbound_ip_log_v1';
const MAX_LOG = 30;

function loadLog(): OutboundIpCheck[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboundIpCheck[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_LOG) : [];
  } catch {
    return [];
  }
}

function saveLog(entry: OutboundIpCheck, prev: OutboundIpCheck[]): OutboundIpCheck[] {
  const next = [entry, ...prev.filter((x) => x.checkedAt !== entry.checkedAt)].slice(0, MAX_LOG);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function formatTh(iso: string): string {
  try {
    return new Date(iso).toLocaleString('th-TH');
  } catch {
    return iso;
  }
}

const VercelOutboundIpTab: React.FC = () => {
  const demo = isDemoMode();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<OutboundIpCheck | null>(null);
  const [log, setLog] = useState<OutboundIpCheck[]>(() => loadLog());
  const [copied, setCopied] = useState(false);

  const allKnownIps = useMemo(() => {
    const set = new Set<string>();
    for (const entry of log) {
      for (const ip of entry.outbound.ips) set.add(ip);
    }
    if (latest) {
      for (const ip of latest.outbound.ips) set.add(ip);
    }
    return [...set].sort();
  }, [log, latest]);

  const runCheck = useCallback(async () => {
    if (demo) {
      setError('โหมดสาธิต — รันเช็กบน Production (Vercel) หลัง login จริง');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch('/api/diagnostics/outbound-ip', { cache: 'no-store' });
      const data = (await r.json().catch(() => ({}))) as OutboundIpCheck & { message?: string; error?: string };
      if (!r.ok) {
        setError(typeof data.message === 'string' ? data.message : data.error || 'เช็ก IP ไม่สำเร็จ');
        return;
      }
      setLatest(data);
      setLog((prev) => saveLog(data, prev));
    } catch {
      setError('เชื่อมต่อ API ไม่ได้');
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    if (!demo) void runCheck();
  }, [demo, runCheck]);

  const copyIps = async () => {
    const text = allKnownIps.join('\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-orange-600" />
              IP ขาออก (Outbound) สำหรับ Firewall Allowlist
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              เช็กจาก API บน <strong className="font-medium text-foreground">Vercel Production</strong> — IP ที่แสดงคือ
              address เดียวกับที่ MSSQL (<code className="text-[11px]">DB_HOST</code>) เห็นเมื่อ Jarvis พยายาม connect
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={loading || demo}
            className="jarvis-pill-btn px-4 py-2 text-sm shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            {loading ? 'กำลังเช็ก…' : 'เช็ก IP ตอนนี้'}
          </button>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 flex gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Vercel Serverless ใช้ IP ขาออกแบบ dynamic — อาจได้หลาย IP หรือเปลี่ยนเมื่อ redeploy
            แนะนำเช็กเป็นระยะและ allowlist ทุก IP ใน log ด้านล่าง หรือใช้{' '}
            <a
              href="https://vercel.com/docs/connectivity/static-ips"
              target="_blank"
              rel="noreferrer"
              className="underline font-medium"
            >
              Vercel Static IPs
            </a>{' '}
            (แผน Pro+) ถ้าต้องการ IP คงที่
          </p>
        </div>

        {error ? (
          <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
            {error}
          </p>
        ) : null}
      </div>

      {latest && latest.targets.mssql.configured ? (
        <section className="rounded-xl border-2 border-orange-400/40 bg-orange-500/10 p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">Allowlist สำหรับ MSSQL ของคุณ</p>
          <p className="text-xs font-mono text-muted-foreground">
            {latest.targets.mssql.host}:{latest.targets.mssql.port} → {latest.targets.mssql.database}
          </p>
          {latest.outbound.ips.length > 0 ? (
            <p className="text-sm text-foreground">
              ให้ IT เปิด firewall รับ IP:{' '}
              <span className="font-mono font-semibold">{latest.outbound.ips.join(', ')}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">ยังไม่พบ IP — กดเช็กอีกครั้ง</p>
          )}
          {latest.targets.mssql.reachable === false ? (
            <p className="text-xs text-amber-900">
              ตอนนี้ยัง connect MSSQL ไม่ได้ (มักเพราะ firewall ยังไม่เปิด) — แต่ IP ด้านบนถูกต้องแล้ว
              ให้เอาไป allow ก่อน แล้วกดเช็กใหม่
            </p>
          ) : latest.targets.mssql.reachable ? (
            <p className="text-xs text-emerald-700 font-medium">MSSQL เชื่อมได้แล้วจาก Deploy นี้</p>
          ) : null}
        </section>
      ) : null}

      {latest ? (
        <div className="grid md:grid-cols-2 gap-4">
          <section className="glass-card rounded-xl border border-border p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ผลล่าสุด</h4>
            <p className="text-xs text-muted-foreground">{formatTh(latest.checkedAt)}</p>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">IP ขาออกที่ตรวจพบ</p>
              {latest.outbound.ips.length === 0 ? (
                <p className="text-sm text-muted-foreground">ไม่พบ IP</p>
              ) : (
                <ul className="space-y-1">
                  {latest.outbound.ips.map((ip) => (
                    <li key={ip} className="font-mono text-sm bg-secondary/50 rounded-lg px-3 py-2">
                      {ip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Runtime: {latest.runtime.vercel ? 'Vercel' : 'Local / อื่นๆ'}</p>
              {latest.runtime.region ? <p>Region: {latest.runtime.region}</p> : null}
              {latest.runtime.url ? <p>URL: {latest.runtime.url}</p> : null}
            </div>
            <div className="text-xs space-y-1 border-t border-border pt-3">
              <p className="font-medium text-foreground">แหล่งที่มา</p>
              {latest.outbound.sources.map((s) => (
                <p key={s.service} className={s.ok ? 'text-muted-foreground' : 'text-destructive'}>
                  {s.service}: {s.ok ? s.ip : s.error || 'failed'}
                </p>
              ))}
            </div>
          </section>

          <section className="glass-card rounded-xl border border-border p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">การเชื่อม DB จาก Deploy นี้</h4>
            {latest.targets.postgres.configured ? (
              <div className="text-sm space-y-1">
                <p className="font-medium">PostgreSQL</p>
                <p className="text-muted-foreground font-mono text-xs">{latest.targets.postgres.host}</p>
                <p
                  className={cn(
                    'text-xs font-medium',
                    latest.targets.postgres.reachable ? 'text-emerald-600' : 'text-destructive',
                  )}
                >
                  {latest.targets.postgres.reachable ? 'เชื่อมได้' : 'เชื่อมไม่ได้'}
                  {latest.targets.postgres.error ? ` — ${latest.targets.postgres.error}` : ''}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">ไม่ได้ตั้ง DATABASE_URL</p>
            )}
            {latest.targets.mssql.configured ? (
              <div className="text-sm space-y-1 border-t border-border pt-3">
                <p className="font-medium">SQL Server (Siamraj)</p>
                <p className="text-muted-foreground font-mono text-xs">
                  {latest.targets.mssql.host}:{latest.targets.mssql.port} / {latest.targets.mssql.database}
                </p>
                <p
                  className={cn(
                    'text-xs font-medium',
                    latest.targets.mssql.reachable ? 'text-emerald-600' : 'text-destructive',
                  )}
                >
                  {latest.targets.mssql.reachable ? 'เชื่อมได้' : 'เชื่อมไม่ได้'}
                  {latest.targets.mssql.error ? ` — ${latest.targets.mssql.error}` : ''}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground border-t border-border pt-3">ไม่ได้ตั้ง DB_HOST (MSSQL)</p>
            )}
            <p className="text-xs text-muted-foreground italic">{latest.firewallHint}</p>
          </section>
        </div>
      ) : null}

      <section className="glass-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">IP ที่เคยพบ (สำหรับ Allowlist)</h4>
          {allKnownIps.length > 0 ? (
            <button
              type="button"
              onClick={() => void copyIps()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกทั้งหมด'}
            </button>
          ) : null}
        </div>
        {allKnownIps.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มี log — กด &quot;เช็ก IP ตอนนี้&quot;</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allKnownIps.map((ip) => (
              <span key={ip} className="font-mono text-xs rounded-full bg-secondary px-3 py-1.5">
                {ip}
              </span>
            ))}
          </div>
        )}

        {log.length > 0 ? (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">ประวัติการเช็ก (ในเบราว์เซอร์นี้)</p>
            <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
              {log.map((entry) => (
                <li key={entry.checkedAt} className="text-muted-foreground">
                  {formatTh(entry.checkedAt)} — {entry.outbound.ips.join(', ') || '—'}
                  {entry.runtime.region ? ` (${entry.runtime.region})` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default VercelOutboundIpTab;
