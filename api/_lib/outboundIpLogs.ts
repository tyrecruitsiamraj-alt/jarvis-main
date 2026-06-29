import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import type { OutboundIpProbeResult } from './outboundIpProbe.js';

const checksTable = tableInAppSchema('outbound_ip_checks');
const entriesTable = tableInAppSchema('outbound_ip_log_entries');
const registryTable = tableInAppSchema('outbound_ip_registry');

export type OutboundIpCheckRow = {
  id: string;
  checked_at: Date | string;
  user_id: string | null;
  user_email: string | null;
  trigger_source: string;
  vercel_region: string | null;
  vercel_url: string | null;
  deployment_id: string | null;
  on_vercel: boolean;
  mssql_host: string | null;
  mssql_port: number | null;
  mssql_database: string | null;
  mssql_reachable: boolean | null;
  mssql_error: string | null;
  postgres_host: string | null;
  postgres_reachable: boolean | null;
  postgres_error: string | null;
  ip_sources: unknown;
  ips?: string[];
};

export type OutboundIpRegistryRow = {
  ip_address: string;
  first_seen_at: Date | string;
  last_seen_at: Date | string;
  seen_count: number;
  last_vercel_region: string | null;
  last_mssql_host: string | null;
  last_mssql_reachable: boolean | null;
};

function toIso(v: Date | string): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export async function saveOutboundIpCheck(
  probe: OutboundIpProbeResult,
  user: { id: string; email: string },
  triggerSource: 'manual' | 'auto' | 'mssql_probe' = 'manual',
): Promise<{ checkId: string }> {
  const { rows } = await dbQuery<{ id: string }>(
    `
      insert into ${checksTable} (
        checked_at, user_id, user_email, trigger_source,
        vercel_region, vercel_url, deployment_id, on_vercel,
        mssql_host, mssql_port, mssql_database, mssql_reachable, mssql_error,
        postgres_host, postgres_reachable, postgres_error,
        ip_sources
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)
      returning id
    `,
    [
      probe.checkedAt,
      user.id,
      user.email,
      triggerSource,
      probe.runtime.region,
      probe.runtime.url,
      probe.runtime.deploymentId,
      probe.runtime.vercel,
      probe.targets.mssql.host,
      probe.targets.mssql.port,
      probe.targets.mssql.database,
      probe.targets.mssql.reachable,
      probe.targets.mssql.error,
      probe.targets.postgres.host,
      probe.targets.postgres.reachable,
      probe.targets.postgres.error,
      JSON.stringify(probe.outbound.sources),
    ],
  );

  const checkId = rows[0]?.id;
  if (!checkId) throw new Error('Failed to save outbound IP check');

  for (const ip of probe.outbound.ips) {
    await dbQuery(
      `
        insert into ${entriesTable} (check_id, ip_address, target_system)
        values ($1, $2, 'egress')
      `,
      [checkId, ip],
    );

    await dbQuery(
      `
        insert into ${registryTable} (
          ip_address, first_seen_at, last_seen_at, seen_count,
          last_vercel_region, last_mssql_host, last_mssql_reachable
        )
        values ($1, $2, $2, 1, $3, $4, $5)
        on conflict (ip_address) do update set
          last_seen_at = excluded.last_seen_at,
          seen_count = ${registryTable}.seen_count + 1,
          last_vercel_region = excluded.last_vercel_region,
          last_mssql_host = excluded.last_mssql_host,
          last_mssql_reachable = excluded.last_mssql_reachable
      `,
      [
        ip,
        probe.checkedAt,
        probe.runtime.region,
        probe.targets.mssql.host,
        probe.targets.mssql.reachable,
      ],
    );
  }

  return { checkId };
}

export async function listOutboundIpChecks(limit = 50): Promise<OutboundIpCheckRow[]> {
  const cap = Math.min(200, Math.max(1, limit));
  const { rows } = await dbQuery<OutboundIpCheckRow>(
    `
      select c.*,
        coalesce(
          (select array_agg(e.ip_address order by e.ip_address)
           from ${entriesTable} e where e.check_id = c.id),
          '{}'
        ) as ips
      from ${checksTable} c
      order by c.checked_at desc
      limit $1
    `,
    [cap],
  );
  return rows.map((r) => ({
    ...r,
    ips: Array.isArray(r.ips) ? r.ips : [],
  }));
}

export async function listOutboundIpRegistry(): Promise<OutboundIpRegistryRow[]> {
  const { rows } = await dbQuery<OutboundIpRegistryRow>(
    `
      select *
      from ${registryTable}
      order by last_seen_at desc
    `,
  );
  return rows;
}

export function formatCheckForApi(row: OutboundIpCheckRow) {
  return {
    id: row.id,
    checkedAt: toIso(row.checked_at),
    userEmail: row.user_email,
    triggerSource: row.trigger_source,
    ips: row.ips ?? [],
    vercelRegion: row.vercel_region,
    vercelUrl: row.vercel_url,
    onVercel: row.on_vercel,
    mssql: {
      host: row.mssql_host,
      port: row.mssql_port,
      database: row.mssql_database,
      reachable: row.mssql_reachable,
      error: row.mssql_error,
    },
    postgres: {
      host: row.postgres_host,
      reachable: row.postgres_reachable,
      error: row.postgres_error,
    },
  };
}

export function formatRegistryForApi(row: OutboundIpRegistryRow) {
  return {
    ip: row.ip_address,
    firstSeenAt: toIso(row.first_seen_at),
    lastSeenAt: toIso(row.last_seen_at),
    seenCount: row.seen_count,
    lastVercelRegion: row.last_vercel_region,
    lastMssqlHost: row.last_mssql_host,
    lastMssqlReachable: row.last_mssql_reachable,
  };
}
