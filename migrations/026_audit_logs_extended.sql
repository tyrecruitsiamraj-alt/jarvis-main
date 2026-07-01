-- Extended audit metadata for server-side mutation tracing (Prompt 6).

alter table audit_logs add column if not exists request_id text null;
alter table audit_logs add column if not exists user_role text null;
alter table audit_logs add column if not exists ip_address text null;
alter table audit_logs add column if not exists user_agent text null;

create index if not exists audit_logs_request_id_idx on audit_logs (request_id);
create index if not exists audit_logs_entity_idx on audit_logs (entity_type, entity_id);
