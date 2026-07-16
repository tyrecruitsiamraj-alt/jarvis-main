-- คำขอ / แจ้งบัค / ขอเพิ่มฟีเจอร์จากผู้ใช้ในแอป
create table if not exists app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  user_email text not null,
  user_name text not null,
  kind text not null check (kind in ('feature', 'change', 'bug', 'other')),
  title text not null,
  body text not null,
  page_path text null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'wontfix')),
  admin_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_feedback_created_at_idx
  on app_feedback (created_at desc);

create index if not exists app_feedback_user_id_idx
  on app_feedback (user_id);

create index if not exists app_feedback_status_idx
  on app_feedback (status);
