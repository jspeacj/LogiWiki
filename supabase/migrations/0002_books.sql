-- ============================================================================
-- LogiWiki — 서적 / 챕터 (Phase 1)
-- 0001_profiles.sql 선행 필요(profiles, is_admin, touch_updated_at).
-- 멱등 SQL. 서적은 AI 초안 + 사람 검수 모델: 어떤 AI 콘텐츠도 관리자 승인 전 발행 불가.
-- ============================================================================

-- ── 1) 서적 ──────────────────────────────────────────────────────────────────
create table if not exists public.books (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null,
  language        text not null default 'ko' check (language in ('ko','en','ja','zh','es')),
  title           text not null check (char_length(title) between 1 and 200),
  description     text not null default '' check (char_length(description) <= 2000),
  topic           text not null,                       -- 코드 SSOT: lib/wiki/topics.ts
  author_id       uuid not null references public.profiles (id) on delete cascade,
  source          text not null default 'human' check (source in ('ai','human')),
  status          text not null default 'draft' check (status in ('draft','in_review','published','archived')),
  ai_model        text,
  view_count      integer not null default 0,          -- denormalized, RPC 소유
  recommend_count integer not null default 0,          -- denormalized, 추천 트리거 소유(0005)
  cover_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  published_at    timestamptz                          -- 최초 발행 시 1회 설정 → sitemap 게이트
);

create unique index if not exists books_slug_lang_key on public.books (slug, language);
create index if not exists books_status_pub_idx on public.books (status, published_at desc);
create index if not exists books_topic_idx on public.books (topic, status);
create index if not exists books_author_created_idx on public.books (author_id, created_at desc);

-- ── 2) 챕터(인접리스트 트리 + fractional sort_order) ─────────────────────────
create table if not exists public.chapters (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books (id) on delete cascade,
  parent_id  uuid references public.chapters (id) on delete cascade,
  slug       text not null check (char_length(slug) between 1 and 120),
  title      text not null check (char_length(title) between 1 and 200),
  body       text not null default '' check (char_length(body) <= 200000),  -- markdown
  sort_order double precision not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists chapters_book_slug_key on public.chapters (book_id, slug);
create index if not exists chapters_book_order_idx on public.chapters (book_id, parent_id, sort_order);

-- ── 3) updated_at 트리거 ─────────────────────────────────────────────────────
drop trigger if exists books_touch_updated_at on public.books;
create trigger books_touch_updated_at
  before update on public.books
  for each row execute function public.touch_updated_at();

drop trigger if exists chapters_touch_updated_at on public.chapters;
create trigger chapters_touch_updated_at
  before update on public.chapters
  for each row execute function public.touch_updated_at();

-- ── 4) 챕터 parent 는 같은 book 이어야 함 ────────────────────────────────────
create or replace function public.enforce_chapter_same_book()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  parent_book uuid;
begin
  if new.parent_id is not null then
    select book_id into parent_book from public.chapters where id = new.parent_id;
    if parent_book is null or parent_book <> new.book_id then
      raise exception 'CHAPTER_PARENT_MISMATCH' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists chapters_same_book on public.chapters;
create trigger chapters_same_book
  before insert or update on public.chapters
  for each row execute function public.enforce_chapter_same_book();

-- ── 5) 발행 전이 강제(AI 소스는 관리자만 발행) + published_at 자동 설정 ────────
-- RLS WITH CHECK 는 OLD→NEW 전이를 표현하기 어려우므로 트리거로 강제한다.
-- 대규모 콘텐츠 남용 방지의 마지막 안전장치: AI 서적은 사람 승인 없이 발행될 수 없다.
create or replace function public.enforce_book_publish()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if new.source = 'ai' and not public.is_admin() then
      raise exception 'PUBLISH_FORBIDDEN_AI' using errcode = 'P0001';
    end if;
    if new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists books_enforce_publish on public.books;
create trigger books_enforce_publish
  before update on public.books
  for each row execute function public.enforce_book_publish();

-- ── 6) 조회수 기록 RPC (Phase 1 기본형; 0006 에서 일별 롤업 추가로 교체) ───────
create or replace function public.record_book_view(p_book_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.books set view_count = view_count + 1 where id = p_book_id;
$$;

-- ── 7) 서적 작성 레이트리밋(순수 Postgres, 외부 의존성 0) ─────────────────────
-- 60초 쿨다운 + 시간당 20건. 관리자 예외(AI 대량 초안 삽입 허용).
create or replace function public.enforce_book_rate_limit()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  last_at timestamptz;
  hourly  int;
begin
  if public.is_admin() then
    return new;
  end if;

  select max(created_at) into last_at
    from public.books where author_id = new.author_id;
  if last_at is not null and now() - last_at < interval '60 seconds' then
    raise exception 'RATE_LIMITED: book cooldown' using errcode = 'P0001';
  end if;

  select count(*) into hourly
    from public.books
    where author_id = new.author_id and created_at > now() - interval '1 hour';
  if hourly >= 20 then
    raise exception 'RATE_LIMITED: hourly book cap' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists books_rate_limit on public.books;
create trigger books_rate_limit
  before insert on public.books
  for each row execute function public.enforce_book_rate_limit();

-- ── 8) RLS ───────────────────────────────────────────────────────────────────
alter table public.books    enable row level security;
alter table public.chapters enable row level security;

-- 읽기: published 는 공개. 저자는 자기 글 전부, 관리자는 전부.
drop policy if exists "books_select_public" on public.books;
create policy "books_select_public" on public.books
  for select using (
    status = 'published' or auth.uid() = author_id or public.is_admin()
  );

-- 쓰기(insert): 본인 명의. AI 소스 삽입은 관리자만(사람은 human 만 생성 가능).
drop policy if exists "books_insert_own" on public.books;
create policy "books_insert_own" on public.books
  for insert with check (
    auth.uid() = author_id and (source = 'human' or public.is_admin())
  );

-- 수정/삭제: 저자 또는 관리자.
drop policy if exists "books_update_own" on public.books;
create policy "books_update_own" on public.books
  for update using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

drop policy if exists "books_delete_own" on public.books;
create policy "books_delete_own" on public.books
  for delete using (auth.uid() = author_id or public.is_admin());

-- 챕터: 부모 서적을 쓸 수 있는 사람만. 읽기는 부모 서적을 읽을 수 있으면.
drop policy if exists "chapters_select_public" on public.chapters;
create policy "chapters_select_public" on public.chapters
  for select using (
    exists (
      select 1 from public.books b
      where b.id = chapters.book_id
        and (b.status = 'published' or b.author_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "chapters_write_own" on public.chapters;
create policy "chapters_write_own" on public.chapters
  for all using (
    exists (
      select 1 from public.books b
      where b.id = chapters.book_id
        and (b.author_id = auth.uid() or public.is_admin())
    )
  ) with check (
    exists (
      select 1 from public.books b
      where b.id = chapters.book_id
        and (b.author_id = auth.uid() or public.is_admin())
    )
  );
