create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  user_name text not null default '',
  action text not null,
  entity_type text not null,
  entity_id text not null,
  old_value text null,
  new_value text null,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on audit_logs (created_at desc);
