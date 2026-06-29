import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import { Copy, Database, Globe, RefreshCw, ShieldAlert } from 'lucide-react';
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
  logId?: string | null;
  saved?: boolean;
  saveError?: string | null;
  registry?: IpRegistryEntry[];
};

type IpRegistryEntry = {
  ip: string;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
  lastVercelRegion: string | null;
  lastMssqlHost: string | null;
  lastMssqlReachable: boolean | null;
};

type IpCheckHistoryRow = {
  id: string;
  checkedAt: string;
  userEmail: string | null;
  ips: string[];
  vercelRegion: string | null;
  onVercel: boolean;
  mssql: {
    host: string | null;
    reachable: boolean | null;
  };
};

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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<OutboundIpCheck | null>(null);
  const [registry, setRegistry] = useState<IpRegistryEntry[]>([]);
  const [history, setHistory] = useState<IpCheckHistoryRow[]>([]);
  const [copied, setCopied] = useState(false);

  const allKnownIps = useMemo(() => registry.map((r) => r.ip).sort(), [registry]);

  const loadHistory = useCallback(async () => {
    if (demo) return;
    setHistoryLoading(true);
    try {
      const r = await apiFetch('/api/diagnostics/outbound-ip?mode=history&limit=50', { cache: 'no-store' });
      const data = (await r.json().catch(() => ({}))) as {
        registry?: IpRegistryEntry[];
        checks?: IpCheckHistoryRow[];
        message?: string;
      };
      if (r.ok) {
        setRegistry(Array.isArray(data.registry) ? data.registry : []);
        setHistory(Array.isArray(data.checks) ? data.checks : []);
      }
    } catch {
      /* ignore — history optional on first load */
    } finally {
      setHistoryLoading(false);
    }
  }, [demo]);

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
      if (Array.isArray(data.registry)) setRegistry(data.registry);
      await loadHistory();
    } catch {
      setError('เชื่อมต่อ API ไม่ได้');
    } finally {
      setLoading(false);
    }
  }, [demo, loadHistory]);

  useEffect(() => {
    if (!demo) {
      void loadHistory();
      void runCheck();
    }
  }, [demo, loadHistory, runCheck]);

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
              address เดียวกับที่ MSSQL (<code className="text-[11px]">DB_HOST</code>) เห็น · บันทึกลง PostgreSQL อัตโนมัติ
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
            Vercel Serverless ใช้ IP ขาออกแบบ dynamic — เก็บทุก IP ในตารางด้านล่างแล้ว allowlist ที่ firewall MSSQL
          </p>
        </div>

        {latest?.saveError ? (
          <p className="text-sm text-amber-800 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            บันทึก DB ไม่สำเร็จ: {latest.saveError} — รัน <code className="text-xs">npm run db:migrate</code> ก่อน
          </p>
        ) : null}

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
          {latest.saved && latest.logId ? (
            <p className="text-xs text-emerald-700 flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> บันทึกลง DB แล้ว
            </p>
          ) : null}
        </section>
      ) : null}

      {latest ? (
        <div className="grid md:grid-cols-2 gap-4">
          <section className="glass-card rounded-xl border border-border p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ผลล่าสุด</h4>
            <p className="text-xs text-muted-foreground">{formatTh(latest.checkedAt)}</p>
            <ul className="space-y-1">
              {latest.outbound.ips.map((ip) => (
                <li key={ip} className="font-mono text-sm bg-secondary/50 rounded-lg px-3 py-2">
                  {ip}
                </li>
              ))}
            </ul>
            {latest.runtime.region ? (
              <p className="text-xs text-muted-foreground">Region: {latest.runtime.region}</p>
            ) : null}
          </section>
          <section className="glass-card rounded-xl border border-border p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">การเชื่อม MSSQL</h4>
            {latest.targets.mssql.configured ? (
              <>
                <p className="font-mono text-xs text-muted-foreground">
                  {latest.targets.mssql.host}:{latest.targets.mssql.port}
                </p>
                <p
                  className={cn(
                    'text-sm font-medium',
                    latest.targets.mssql.reachable ? 'text-emerald-600' : 'text-destructive',
                  )}
                >
                  {latest.targets.mssql.reachable ? 'เชื่อมได้' : 'เชื่อมไม่ได้'}
                  {latest.targets.mssql.error ? ` — ${latest.targets.mssql.error}` : ''}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">ไม่ได้ตั้ง DB_HOST</p>
            )}
            <p className="text-xs text-muted-foreground italic">{latest.firewallHint}</p>
          </section>
        </div>
      ) : null}

      <section className="glass-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-orange-600" />
            IP ที่เคย Connect (เก็บใน Database)
          </h4>
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

        {historyLoading && registry.length === 0 ? (
          <p className="text-sm text-muted-foreground">กำลังโหลดจาก DB…</p>
        ) : registry.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล — กดเช็ก IP ครั้งแรก</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">IP</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">เห็นครั้งแรก</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">ล่าสุด</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">ครั้ง</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Region</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">MSSQL</th>
                </tr>
              </thead>
              <tbody>
                {registry.map((row) => (
                  <tr key={row.ip} className="border-b border-border/50">
                    <td className="px-3 py-2 font-mono font-medium">{row.ip}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatTh(row.firstSeenAt)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatTh(row.lastSeenAt)}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{row.seenCount}</td>
                    <td className="px-3 py-2 text-xs">{row.lastVercelRegion || '—'}</td>
                    <td className="px-3 py-2 text-center text-xs">
                      {row.lastMssqlReachable === true ? (
                        <span className="text-emerald-600">OK</span>
                      ) : row.lastMssqlReachable === false ? (
                        <span className="text-destructive">fail</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {history.length > 0 ? (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">ประวัติการเช็ก (จาก Database)</p>
            <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
              {history.map((row) => (
                <li key={row.id} className="text-muted-foreground">
                  {formatTh(row.checkedAt)} — {row.ips.join(', ') || '—'}
                  {row.vercelRegion ? ` (${row.vercelRegion})` : ''}
                  {row.userEmail ? ` · ${row.userEmail}` : ''}
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
