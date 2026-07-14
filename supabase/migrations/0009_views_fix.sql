-- ============================================================================
-- LogiWiki — 조회수/랭킹 정상화 + book_view_daily 보안
-- 0005_views_rankings.sql 선행. 멱등 SQL.
--
-- 증상: 서적을 열면 books.view_count 는 오르는데 book_view_daily 가 비어 있고,
--       top_books(랭킹)의 window_views 가 항상 0 이었다.
--
-- 원인 두 가지를 모두 잡는다:
--   (A) record_book_view 가 0002 의 단순 버전(books.view_count 만 증가)으로 남아 있는 경우
--       → 0005 의 일별 롤업 버전으로 다시 교체한다.
--   (B) book_view_daily 에 RLS 가 걸려 top_books 가 행을 못 읽는 경우
--       → top_books 를 security definer 로 바꿔 소유자 권한으로 집계한다.
--
-- 덤으로 보안 구멍을 막는다: book_view_daily 는 랭킹의 원천 데이터인데 쓰기 권한이
-- anon/authenticated 에 열려 있으면 누구나 PostgREST 로 조회수를 조작할 수 있다.
-- (0008 에서 books.view_count 를 막았지만, 일별 버킷은 그대로 노출돼 있었다.)
-- ============================================================================

-- ── 1) 조회수 기록 RPC: books.view_count 증가 + 일별 버킷 upsert (원자적 1문장) ──
create or replace function public.record_book_view(p_book_id uuid)
returns void language sql security definer set search_path = public as $$
  with bump as (
    update public.books set view_count = view_count + 1 where id = p_book_id returning id
  )
  insert into public.book_view_daily (book_id, view_date, views)
  select id, current_date, 1 from bump
  on conflict (book_id, view_date)
    do update set views = public.book_view_daily.views + 1;
$$;

-- ── 2) 랭킹 RPC: security definer 로 집계 ─────────────────────────────────────
-- book_view_daily 에 RLS 가 걸려도(3번에서 건다) 랭킹은 정상 동작해야 한다.
-- 반환 컬럼에 민감정보가 없고 published 서적만 집계하므로 definer 로 안전하다.
create or replace function public.top_books(
  p_window_days int,
  p_topic text default null,
  p_limit int default 20
)
returns table (
  book_id uuid, slug text, title text, topic text, language text,
  window_views bigint, recommend_count int, score numeric
)
language sql stable security definer set search_path = public as $$
  select
    b.id, b.slug, b.title, b.topic, b.language,
    coalesce(sum(v.views), 0) as window_views,
    b.recommend_count,
    coalesce(sum(v.views), 0) + 3 * b.recommend_count as score
  from public.books b
  left join public.book_view_daily v
    on v.book_id = b.id and v.view_date > current_date - p_window_days
  where b.status = 'published'
    and (p_topic is null or b.topic = p_topic)
  group by b.id
  order by score desc, window_views desc
  limit p_limit;
$$;

-- ── 3) book_view_daily 쓰기 차단 ─────────────────────────────────────────────
-- 이 테이블은 record_book_view(security definer)와 prune cron(service_role)만 건드린다.
-- 클라이언트 롤에는 어떤 권한도 주지 않는다 → PostgREST 로 직접 조작 불가.
alter table public.book_view_daily enable row level security;

-- RLS 를 켜면 정책이 없는 한 anon/authenticated 는 아무것도 못 한다.
-- (security definer 함수와 service_role 은 RLS 를 우회하므로 영향 없음)
drop policy if exists "book_view_daily_no_client_access" on public.book_view_daily;

revoke all on public.book_view_daily from anon, authenticated;
