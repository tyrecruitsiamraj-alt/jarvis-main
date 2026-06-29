-- บันทึก IP ขาออก (egress) จาก Vercel/API ที่ใช้ connect ไป MSSQL/Postgres
create extension if not exists pgcrypto;

create table if not exists outbound_ip_checks (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  user_id uuid null,
  user_email text null,
  trigger_source text not null default 'manual'
    check (trigger_source in ('manual', 'auto', 'mssql_probe')),
  vercel_region text null,
  vercel_url text null,
  deployment_id text null,
  on_vercel boolean not null default false,
  mssql_host text null,
  mssql_port integer null,
  mssql_database text null,
  mssql_reachable boolean null,
  mssql_error text null,
  postgres_host text null,
  postgres_reachable boolean null,
  postgres_error text null,
  ip_sources jsonb null
);

create index if not exists outbound_ip_checks_checked_idx on outbound_ip_checks (checked_at desc);

create table if not exists outbound_ip_log_entries (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references outbound_ip_checks (id) on delete cascade,
  ip_address text not null,
  target_system text not null default 'egress'
    check (target_system in ('egress', 'mssql', 'postgres')),
  created_at timestamptz not null default now()
);

create index if not exists outbound_ip_log_entries_ip_idx on outbound_ip_log_entries (ip_address);
create index if not exists outbound_ip_log_entries_check_idx on outbound_ip_log_entries (check_id);
create index if not exists outbound_ip_log_entries_created_idx on outbound_ip_log_entries (created_at desc);

-- สรุป IP ที่เคยพบ (สำหรับ firewall allowlist)
create table if not exists outbound_ip_registry (
  ip_address text primary key,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  seen_count integer not null default 1,
  last_vercel_region text null,
  last_mssql_host text null,
  last_mssql_reachable boolean null
);

create index if not exists outbound_ip_registry_last_seen_idx on outbound_ip_registry (last_seen_at desc);
