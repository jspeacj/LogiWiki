-- ============================================================================
-- LogiWiki — AI 생성 job 큐 (Phase 3)
-- 0001_profiles.sql, 0002_books.sql 선행. 멱등 SQL.
-- 액션이 enqueue → cron 이 drain(Claude 호출) → books/chapters draft 삽입.
-- 큐 = 볼륨 제어 + 감사 + 재시도 표면(대규모 콘텐츠 남용 억제).
-- ============================================================================

create table if not exists public.ai_generation_jobs (
  id            uuid primary key default gen_random_uuid(),
  topic         text not null,
  subtopic      text not null,
  language      text not null default 'ko',
  model         text not null default 'claude-haiku-4-5',
  status        text not null default 'pending' check (status in ('pending','running','done','failed')),
  requested_by  uuid references public.profiles (id) on delete set null,
  book_id       uuid references public.books (id) on delete set null,
  error         text,
  attempts      int not null default 0,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

create index if not exists ai_jobs_status_idx on public.ai_generation_jobs (status, created_at);

-- 오늘 생성된 job 수(일일 캡 검사용).
create or replace function public.ai_jobs_today()
returns int language sql stable set search_path = public as $$
  select count(*)::int from public.ai_generation_jobs where created_at::date = current_date;
$$;

-- ── RLS: 관리자 전용(서비스 role 은 RLS 우회) ────────────────────────────────
alter table public.ai_generation_jobs enable row level security;

drop policy if exists "ai_jobs_admin" on public.ai_generation_jobs;
create policy "ai_jobs_admin" on public.ai_generation_jobs
  for all using (public.is_admin()) with check (public.is_admin());
