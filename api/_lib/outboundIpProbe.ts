const IP_SOURCES = [
  { name: 'api.ipify.org', url: 'https://api.ipify.org?format=text', parse: (body: string) => body.trim() },
  { name: 'ifconfig.me', url: 'https://ifconfig.me/ip', parse: (body: string) => body.trim() },
  { name: 'checkip.amazonaws.com', url: 'https://checkip.amazonaws.com', parse: (body: string) => body.trim() },
] as const;

const PROBE_TIMEOUT_MS = 8000;

function isLikelyIp(value: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value) || value.includes(':');
}

async function probeIpSource(source: (typeof IP_SOURCES)[number]): Promise<{
  service: string;
  ip: string | null;
  ok: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(source.url, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { Accept: 'text/plain' },
    });
    const body = await res.text();
    if (!res.ok) {
      return { service: source.name, ip: null, ok: false, error: `HTTP ${res.status}` };
    }
    const ip = source.parse(body);
    if (!ip || !isLikelyIp(ip)) {
      return { service: source.name, ip: null, ok: false, error: 'invalid response' };
    }
    return { service: source.name, ip, ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { service: source.name, ip: null, ok: false, error: message };
  }
}

export type OutboundIpProbeResult = {
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
    sources: Awaited<ReturnType<typeof probeIpSource>>[];
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

function parsePgHost(databaseUrl: string): string | null {
  try {
    const u = new URL(databaseUrl.replace(/^postgresql:/, 'postgres:'));
    return u.hostname || null;
  } catch {
    return null;
  }
}

export async function probeOutboundIpAndTargets(): Promise<OutboundIpProbeResult> {
  const sources = await Promise.all(IP_SOURCES.map((s) => probeIpSource(s)));
  const ips = [...new Set(sources.map((s) => s.ip).filter((ip): ip is string => !!ip))];

  const databaseUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
  let postgresReachable: boolean | null = null;
  let postgresError: string | null = null;
  if (databaseUrl) {
    try {
      const { dbPing } = await import('./postgres.js');
      postgresReachable = await dbPing();
      if (!postgresReachable) postgresError = 'DB ping failed';
    } catch (e) {
      postgresReachable = false;
      postgresError = e instanceof Error ? e.message : String(e);
    }
  }

  const mssqlCfg = (await import('./siamrajSqlServer.js')).getSiamrajSqlServerConfig();
  let mssqlReachable: boolean | null = null;
  let mssqlError: string | null = null;
  if (mssqlCfg) {
    try {
      const { siamrajSqlServerPing } = await import('./siamrajSqlServer.js');
      mssqlReachable = await siamrajSqlServerPing();
      if (!mssqlReachable) mssqlError = 'MSSQL ping failed';
    } catch (e) {
      mssqlReachable = false;
      mssqlError = e instanceof Error ? e.message : String(e);
    }
  }

  const onVercel = process.env.VERCEL === '1';

  return {
    checkedAt: new Date().toISOString(),
    runtime: {
      nodeEnv: process.env.NODE_ENV || null,
      vercel: onVercel,
      region: process.env.VERCEL_REGION || null,
      url: process.env.VERCEL_URL || null,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
    },
    outbound: { ips, sources },
    targets: {
      postgres: {
        configured: !!databaseUrl,
        host: databaseUrl ? parsePgHost(databaseUrl) : null,
        reachable: postgresReachable,
        error: postgresError,
      },
      mssql: {
        configured: !!mssqlCfg,
        host: mssqlCfg?.server ?? null,
        port: mssqlCfg?.port ?? null,
        database: mssqlCfg?.database ?? null,
        reachable: mssqlReachable,
        error: mssqlError,
      },
    },
    firewallHint: mssqlCfg
      ? onVercel
        ? `IP ใน outbound.ips คือ source ที่ ${mssqlCfg.server}:${mssqlCfg.port} (MSSQL) จะเห็น — allowlist ที่ firewall แม้ตอนนี้ยัง connect ไม่ได้`
        : `รันเช็กบน Production Vercel — IP ที่แสดงจากเครื่อง local ไม่ใช่ IP ที่ MSSQL ${mssqlCfg.server} จะเห็น`
      : onVercel
        ? 'IP ขาออกจาก Vercel อาจเปลี่ยนได้ (ยกเว้นเปิด Static IPs) — เก็บ log ทุกครั้งที่เช็กแล้ว allowlist ทุก IP ที่พบ'
        : 'รันเช็กบน Production (Vercel) เพื่อดู IP ที่ Database จะเห็นจาก Deploy จริง — local dev ใช้ IP ของเครื่องคุณ',
  };
}
