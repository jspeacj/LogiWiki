-- ============================================================================
-- LogiWiki — 랭킹 정렬 기준 추가 (종합 / 조회수 / 추천수)
-- 0005_views_rankings.sql, 0009_views_fix.sql 선행. 멱등 SQL.
--
-- top_books 에 p_sort 를 추가한다:
--   'score'      — 종합 점수(윈도 조회수 + 3×추천수). 기존 동작(기본값).
--   'views'      — 윈도 기간 조회수 순.
--   'recommends' — 추천수 순.
--
-- ⚠️ 기존 3인자 함수는 반드시 DROP 한다. 기본값을 가진 4인자 함수를 새로 만들면
--    3개 인자로 호출할 때 두 함수가 모두 후보가 되어 PostgREST 가
--    "function is not unique" 로 실패한다(오버로드 모호성).
-- ============================================================================

drop function if exists public.top_books(int, text, int);

create or replace function public.top_books(
  p_window_days int,
  p_topic text default null,
  p_limit int default 20,
  p_sort text default 'score'
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
  order by
    -- 선택된 기준만 값이 있고 나머지는 NULL → nulls last 로 무시된다.
    case when p_sort = 'views'      then coalesce(sum(v.views), 0) end desc nulls last,
    case when p_sort = 'recommends' then b.recommend_count end desc nulls last,
    case when p_sort = 'score'      then coalesce(sum(v.views), 0) + 3 * b.recommend_count end desc nulls last,
    -- 동점 처리: 조회수 → 추천수 → 최근 발행 순.
    coalesce(sum(v.views), 0) desc,
    b.recommend_count desc,
    b.published_at desc nulls last
  limit p_limit;
$$;
