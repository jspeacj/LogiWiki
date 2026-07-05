-- ============================================================================
-- LogiWiki — 자유게시판 (Phase 2)
-- 0001_profiles.sql 선행 필요(profiles, is_admin, touch_updated_at).
-- posts / comments + RLS + 조회수 RPC + 서버 액션 rate limiting(외부 의존성 0).
-- 멱등 SQL.
-- ============================================================================

-- ── 1) 게시글 ────────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  category   text not null check (category in ('notice','qna','tip','free','etc')),
  title      text not null check (char_length(title) between 1 and 150),
  content    text not null check (char_length(content) between 1 and 20000),
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_category_idx   on public.posts (category);
create index if not exists posts_author_idx     on public.posts (author_id);
create index if not exists posts_title_lower_idx on public.posts (lower(title));
create index if not exists posts_author_created_idx on public.posts (author_id, created_at desc);

-- ── 2) 댓글 ──────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  content      text not null check (char_length(content) between 1 and 5000),
  edited       boolean not null default false,
  deleted_at   timestamptz,
  deleted_kind text check (deleted_kind in ('user', 'admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments (post_id, created_at);
create index if not exists comments_author_created_idx on public.comments (author_id, created_at desc);

-- ── 3) updated_at 트리거 ─────────────────────────────────────────────────────
drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();

drop trigger if exists comments_touch_updated_at on public.comments;
create trigger comments_touch_updated_at
  before update on public.comments
  for each row execute function public.touch_updated_at();

-- ── 4) 조회수 증가 RPC ───────────────────────────────────────────────────────
create or replace function public.increment_post_views(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.posts set view_count = view_count + 1 where id = p_id;
$$;

-- ── 5) rate limiting (posts 30초/시간당15, comments 10초/시간당40, 관리자 예외) ──
create or replace function public.enforce_post_rate_limit()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  last_at      timestamptz;
  recent_count int;
  cooldown     constant interval := interval '30 seconds';
  window_span  constant interval := interval '1 hour';
  window_max   constant int := 15;
begin
  if public.is_admin() then return new; end if;

  select max(created_at) into last_at from public.posts where author_id = new.author_id;
  if last_at is not null and now() - last_at < cooldown then
    raise exception 'RATE_LIMITED: 글은 % 초마다 하나만 작성할 수 있습니다.',
      floor(extract(epoch from cooldown))::int using errcode = 'P0001';
  end if;

  select count(*) into recent_count from public.posts
    where author_id = new.author_id and created_at > now() - window_span;
  if recent_count >= window_max then
    raise exception 'RATE_LIMITED: 시간당 글 작성 한도(%개)를 초과했습니다.', window_max
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit
  before insert on public.posts
  for each row execute function public.enforce_post_rate_limit();

create or replace function public.enforce_comment_rate_limit()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  last_at      timestamptz;
  recent_count int;
  cooldown     constant interval := interval '10 seconds';
  window_span  constant interval := interval '1 hour';
  window_max   constant int := 40;
begin
  if public.is_admin() then return new; end if;

  select max(created_at) into last_at from public.comments where author_id = new.author_id;
  if last_at is not null and now() - last_at < cooldown then
    raise exception 'RATE_LIMITED: 댓글은 % 초마다 하나만 작성할 수 있습니다.',
      floor(extract(epoch from cooldown))::int using errcode = 'P0001';
  end if;

  select count(*) into recent_count from public.comments
    where author_id = new.author_id and created_at > now() - window_span;
  if recent_count >= window_max then
    raise exception 'RATE_LIMITED: 시간당 댓글 작성 한도(%개)를 초과했습니다.', window_max
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit
  before insert on public.comments
  for each row execute function public.enforce_comment_rate_limit();

-- ── 6) RLS ───────────────────────────────────────────────────────────────────
alter table public.posts    enable row level security;
alter table public.comments enable row level security;

-- posts: 누구나 조회 / 본인 명의 작성(공지는 관리자만) / 작성자·관리자 수정·삭제
drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all" on public.posts for select using (true);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own" on public.posts
  for insert with check (
    auth.uid() = author_id and (category <> 'notice' or public.is_admin())
  );

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts
  for update using (auth.uid() = author_id or public.is_admin())
  with check (
    (auth.uid() = author_id or public.is_admin())
    and (category <> 'notice' or public.is_admin())
  );

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts
  for delete using (auth.uid() = author_id or public.is_admin());

-- comments: 누구나 조회 / 본인 명의 작성 / 작성자·관리자 수정·삭제(소프트삭제=UPDATE)
drop policy if exists "comments_select_all" on public.comments;
create policy "comments_select_all" on public.comments for select using (true);

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments
  for insert with check (auth.uid() = author_id);

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments
  for update using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments
  for delete using (auth.uid() = author_id or public.is_admin());
