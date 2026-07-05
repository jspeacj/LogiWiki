-- ============================================================================
-- LogiWiki — 조회수 일별 롤업 + 랭킹(주/월/년) (Phase 3)
-- 0002_books.sql 선행 필요. 멱등 SQL.
-- 무제한 이벤트 테이블 대신 (book_id, 날짜) 일별 버킷으로 성장 제한.
-- ============================================================================

create table if not exists public.book_view_daily (
  book_id   uuid not null references public.books (id) on delete cascade,
  view_date date not null default current_date,
  views     integer not null default 0,
  primary key (book_id, view_date)
);

create index if not exists book_view_daily_date_idx on public.book_view_daily (view_date);

-- record_book_view 를 교체: books.view_count 증가 + 일별 버킷 upsert(원자적 1문장).
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

-- 랭킹: 최근 N일 조회수 + 3*추천수 점수로 상위 서적. week/month/year = 7/30/365.
create or replace function public.top_books(
  p_window_days int,
  p_topic text default null,
  p_limit int default 20
)
returns table (
  book_id uuid, slug text, title text, topic text, language text,
  window_views bigint, recommend_count int, score numeric
)
language sql stable set search_path = public as $$
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
