-- 0014_bookmarks.sql  (**필수**)
--
-- 서적 즐겨찾기(로그인 사용자 전용, 비공개).
--
-- 추천(0004 book_recommendations)과 구조는 같지만 두 가지가 다르다:
--   1) **비공개** — select 정책이 owner 전용(auth.uid() = user_id). 추천은 공개 카운트를
--      위해 select 가 전체 공개였지만, 즐겨찾기는 "내 서재"라 남이 볼 이유가 없다.
--   2) **카운터 없음** — 공개 집계가 필요 없으므로 books 에 denormalized 컬럼도,
--      동기화 트리거도 두지 않는다(추천의 sync_book_recommend_count 같은 것이 불필요).
--
-- 3중 방어(AGENTS.md): 클라 검증 + 서버 액션(requireUser) + DB(RLS/제약).
-- 0001_profiles, 0002_books 선행 필요. 멱등(if not exists / drop ... if exists).

create table if not exists public.book_bookmarks (
  book_id    uuid not null references public.books (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 1인 1서적 1회(구조적 중복 방지). 토글 해제 후 재추가도 자연스럽게 동작.
  primary key (book_id, user_id)
);

-- "내 즐겨찾기를 최근순으로" 조회 경로(/favorites).
create index if not exists book_bookmarks_user_idx
  on public.book_bookmarks (user_id, created_at desc);

alter table public.book_bookmarks enable row level security;

-- 읽기: **본인 것만**. 추천과 달리 비공개다.
drop policy if exists "book_bookmarks_select_own" on public.book_bookmarks;
create policy "book_bookmarks_select_own" on public.book_bookmarks
  for select using (auth.uid() = user_id);

-- 추가: 본인 명의 + **발행된 서적만**. 비발행/초안은 즐겨찾기 불가.
drop policy if exists "book_bookmarks_insert_own" on public.book_bookmarks;
create policy "book_bookmarks_insert_own" on public.book_bookmarks
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.books b where b.id = book_id and b.status = 'published')
  );

-- 삭제(토글 해제): 본인 것만.
drop policy if exists "book_bookmarks_delete_own" on public.book_bookmarks;
create policy "book_bookmarks_delete_own" on public.book_bookmarks
  for delete using (auth.uid() = user_id);
