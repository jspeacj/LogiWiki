-- ============================================================================
-- LogiWiki — 서적 추천(1인 1회) + 서적 댓글 (Phase 2)
-- 0001_profiles.sql, 0002_books.sql 선행 필요.
-- 멱등 SQL.
-- ============================================================================

-- ── 1) 서적 추천 (1인 1서적 1회, 구조적 중복방지) ─────────────────────────────
create table if not exists public.book_recommendations (
  book_id    uuid not null references public.books (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

create index if not exists book_recs_user_idx
  on public.book_recommendations (user_id, created_at desc);

-- books.recommend_count 동기화. security definer 필수:
-- 추천 행위자는 타인 서적에 대한 books UPDATE 권한이 RLS 상 없으므로,
-- 트리거가 소유자 권한으로 카운터를 갱신해야 한다.
create or replace function public.sync_book_recommend_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.books set recommend_count = recommend_count + 1 where id = new.book_id;
  elsif tg_op = 'DELETE' then
    update public.books set recommend_count = greatest(0, recommend_count - 1) where id = old.book_id;
  end if;
  return null;
end;
$$;

drop trigger if exists book_recs_sync_insert on public.book_recommendations;
create trigger book_recs_sync_insert
  after insert on public.book_recommendations
  for each row execute function public.sync_book_recommend_count();

drop trigger if exists book_recs_sync_delete on public.book_recommendations;
create trigger book_recs_sync_delete
  after delete on public.book_recommendations
  for each row execute function public.sync_book_recommend_count();

alter table public.book_recommendations enable row level security;

drop policy if exists "book_recs_select" on public.book_recommendations;
create policy "book_recs_select" on public.book_recommendations
  for select using (true);

-- 본인 명의 + 발행된 서적만 추천 가능.
drop policy if exists "book_recs_insert_own" on public.book_recommendations;
create policy "book_recs_insert_own" on public.book_recommendations
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.books b where b.id = book_id and b.status = 'published')
  );

drop policy if exists "book_recs_delete_own" on public.book_recommendations;
create policy "book_recs_delete_own" on public.book_recommendations
  for delete using (auth.uid() = user_id);

-- ── 2) 서적 댓글 (로그인 사용자만 작성, 비회원 열람) ──────────────────────────
create table if not exists public.book_comments (
  id           uuid primary key default gen_random_uuid(),
  book_id      uuid not null references public.books (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  content      text not null check (char_length(content) between 1 and 5000),
  edited       boolean not null default false,
  deleted_at   timestamptz,
  deleted_kind text check (deleted_kind in ('user', 'admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists book_comments_book_idx on public.book_comments (book_id, created_at);
create index if not exists book_comments_author_created_idx on public.book_comments (author_id, created_at desc);

drop trigger if exists book_comments_touch_updated_at on public.book_comments;
create trigger book_comments_touch_updated_at
  before update on public.book_comments
  for each row execute function public.touch_updated_at();

-- rate limit(10초 쿨다운 + 시간당 40, 관리자 예외).
create or replace function public.enforce_book_comment_rate_limit()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  last_at      timestamptz;
  recent_count int;
  cooldown     constant interval := interval '10 seconds';
  window_span  constant interval := interval '1 hour';
  window_max   constant int := 40;
begin
  if public.is_admin() then return new; end if;

  select max(created_at) into last_at from public.book_comments where author_id = new.author_id;
  if last_at is not null and now() - last_at < cooldown then
    raise exception 'RATE_LIMITED: 댓글은 % 초마다 하나만 작성할 수 있습니다.',
      floor(extract(epoch from cooldown))::int using errcode = 'P0001';
  end if;

  select count(*) into recent_count from public.book_comments
    where author_id = new.author_id and created_at > now() - window_span;
  if recent_count >= window_max then
    raise exception 'RATE_LIMITED: 시간당 댓글 작성 한도(%개)를 초과했습니다.', window_max
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists book_comments_rate_limit on public.book_comments;
create trigger book_comments_rate_limit
  before insert on public.book_comments
  for each row execute function public.enforce_book_comment_rate_limit();

alter table public.book_comments enable row level security;

-- 읽기: 서적을 볼 수 있으면(발행 or 저자 or 관리자) 댓글도 조회.
drop policy if exists "book_comments_select" on public.book_comments;
create policy "book_comments_select" on public.book_comments
  for select using (
    exists (
      select 1 from public.books b
      where b.id = book_comments.book_id
        and (b.status = 'published' or b.author_id = auth.uid() or public.is_admin())
    )
  );

-- 작성: 본인 명의 + 발행된 서적만.
drop policy if exists "book_comments_insert_own" on public.book_comments;
create policy "book_comments_insert_own" on public.book_comments
  for insert with check (
    auth.uid() = author_id
    and exists (select 1 from public.books b where b.id = book_id and b.status = 'published')
  );

drop policy if exists "book_comments_update_own" on public.book_comments;
create policy "book_comments_update_own" on public.book_comments
  for update using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

drop policy if exists "book_comments_delete_own" on public.book_comments;
create policy "book_comments_delete_own" on public.book_comments
  for delete using (auth.uid() = author_id or public.is_admin());
