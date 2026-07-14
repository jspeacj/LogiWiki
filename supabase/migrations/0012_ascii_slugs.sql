-- ============================================================================
-- LogiWiki — slug 를 ASCII 로 강제 (Phase 4 후속)
-- 0002_books.sql 선행. 멱등 SQL.
--
-- 증상: AI 가 만든 한글 제목 서적("React 렌더링 최적화 …")의 slug 에 한글이 들어갔고,
--       그 서적을 열면 404 가 났다.
--
-- 원인: PostgREST 필터에 비ASCII 값을 넣으면 요청이 실패한다.
--         GET /rest/v1/books?slug=eq.react-렌더링-…  →  "Something went wrong"
--       getBookBySlug 의 쿼리가 통째로 죽고 null 을 반환해 notFound() 로 떨어졌다.
--
-- 조치:
--   1) 기존 행의 비ASCII slug 를 ASCII 로 정규화(제거 후 남는 게 없으면 topic/순서로 대체)
--   2) CHECK 제약으로 앞으로는 비ASCII slug 가 애초에 들어갈 수 없게 한다
--
-- 앱·워크플로 쪽 slugify 도 함께 고쳤다(lib/slug.ts). 이 마이그레이션은 DB 측 방어선이다.
-- ============================================================================

-- ── 1) 기존 slug 정규화 ──────────────────────────────────────────────────────
-- books: 비ASCII 문자를 제거하고 하이픈을 정리한다. 남는 게 없으면 topic 을 쓴다.
-- 충돌 방지를 위해 id 앞 6자리를 접미사로 붙인다(원래 slug 에 이미 랜덤 접미사가 있지만
-- 한글이 제거되면서 중복될 수 있으므로).
with normalized as (
  select
    id,
    topic,
    nullif(
      regexp_replace(
        regexp_replace(lower(slug), '[^a-z0-9-]+', '-', 'g'),  -- 비ASCII·기호 → 하이픈
        '(^-+|-+$)', '', 'g'                                   -- 앞뒤 하이픈 제거
      ),
      ''
    ) as clean
  from public.books
  where slug !~ '^[a-z0-9][a-z0-9-]*$'   -- 비ASCII 가 섞인 행만
)
update public.books b
   set slug = left(
         coalesce(regexp_replace(n.clean, '-{2,}', '-', 'g'), n.topic) || '-' || substr(b.id::text, 1, 6),
         80
       )
  from normalized n
 where b.id = n.id;

-- chapters: 같은 방식. 남는 게 없으면 순서 기반(chapter-N)으로.
with normalized as (
  select
    id,
    book_id,
    sort_order,
    nullif(
      regexp_replace(
        regexp_replace(lower(slug), '[^a-z0-9-]+', '-', 'g'),
        '(^-+|-+$)', '', 'g'
      ),
      ''
    ) as clean
  from public.chapters
  where slug !~ '^[a-z0-9][a-z0-9-]*$'
)
update public.chapters c
   set slug = left(
         coalesce(
           regexp_replace(n.clean, '-{2,}', '-', 'g'),
           'chapter-' || greatest(1, round(n.sort_order / 1000)::int)::text
         ),
         120
       )
  from normalized n
 where c.id = n.id;

-- ── 2) 재발 방지 CHECK 제약 ──────────────────────────────────────────────────
-- 여기까지 왔는데도 위반 행이 남아 있으면 제약 추가가 실패한다(= 정규화가 덜 된 것).
-- 그 경우 이 마이그레이션 전체가 롤백되므로 데이터가 어중간해지지 않는다.
alter table public.books drop constraint if exists books_slug_ascii_chk;
alter table public.books
  add constraint books_slug_ascii_chk
  check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$');

alter table public.chapters drop constraint if exists chapters_slug_ascii_chk;
alter table public.chapters
  add constraint chapters_slug_ascii_chk
  check (slug ~ '^[a-z0-9][a-z0-9-]{0,119}$');
