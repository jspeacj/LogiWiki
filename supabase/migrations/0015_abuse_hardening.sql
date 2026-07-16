-- ============================================================================
-- LogiWiki — 남용 방지 강화: 채점 카운터 위조 차단 + 조회수 RPC 비공개화
--
-- 0006/0008/0009 선행. 멱등 SQL.
--
-- 두 구멍 모두 "카운터를 세는 곳"과 "카운터를 쓸 수 있는 주체"가 어긋나서 생겼다.
-- 방어 로직 자체는 멀쩡했는데, 세는 대상을 공격자가 지울 수 있거나(1) 애초에 카운터를
-- 거치지 않고 원천 RPC 를 때릴 수 있어서(2) 무력화됐다.
-- ============================================================================

-- ── 1) quiz_attempts: 본인 시도의 UPDATE/DELETE 차단 ─────────────────────────
--
-- 0006 의 정책은 `for all` 이라 SELECT/INSERT 뿐 아니라 UPDATE/DELETE 까지 열려 있었다.
-- 그런데 AI 채점(유료 Claude 호출) 상한은 **두 개 모두** 이 테이블의 행 수로 센다:
--   - app/actions/quiz.ts  : graded_by='ai' 인 최근 1시간 행 수 ≥ 30 이면 차단(호출 前)
--   - 0008 의 트리거       : 최근 1시간 행 수 ≥ 60 이면 INSERT 거부
--
-- 즉 로그인 사용자가 PostgREST 로 `DELETE /rest/v1/quiz_attempts?user_id=eq.<자기 uid>`
-- 를 한 번 쏘면 두 상한이 동시에 0 으로 리셋된다 → 유료 API 무제한 호출. 인메모리 IP
-- 리미터는 서버리스 인스턴스마다 따로 놀아 실질 방어가 못 된다(quiz.ts 주석 참고).
--
-- 시도 기록은 append-only 여야 한다. 사용자가 자기 학습 이력을 지우는 UX 는 없고,
-- 계정 삭제 시엔 on delete cascade 가 처리한다.
drop policy if exists "quiz_attempts_own" on public.quiz_attempts;

drop policy if exists "quiz_attempts_select_own" on public.quiz_attempts;
create policy "quiz_attempts_select_own" on public.quiz_attempts
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "quiz_attempts_insert_own" on public.quiz_attempts;
create policy "quiz_attempts_insert_own" on public.quiz_attempts
  for insert with check (auth.uid() = user_id);

-- 정책이 없으면 UPDATE/DELETE 는 이미 거부되지만, 테이블 GRANT 까지 회수해 이중으로 막는다
-- (0009 가 book_view_daily 에 한 것과 같은 이유 — Supabase 기본 권한이 넉넉하다).
revoke update, delete on public.quiz_attempts from anon, authenticated;

-- ── 2) record_book_view: 공개 RPC → 서버 전용 + 뷰어 단위 중복 제거 ──────────
--
-- 0008/0009 는 books.view_count 직접 UPDATE(guard 트리거)와 book_view_daily 직접 쓰기
-- (revoke)를 막았다. 그런데 정작 두 값을 올리는 원천 RPC 는 security definer 인 채로
-- anon 에게 열려 있었다. 익명 키는 클라이언트 번들에 들어 있으므로:
--   POST /rest/v1/rpc/record_book_view {"p_book_id": "<아무 서적>"}  ← 무한 반복
-- 만으로 랭킹(top_books 의 window_views)과 `popular` 정렬을 임의로 조작할 수 있었다.
--
-- 해결: RPC 실행 권한을 anon/authenticated 에서 회수하고 service-role 에서만 부른다.
-- 뷰어 식별자(IP+UA 해시)는 앱이 **서버에서** 계산해 넘긴다 — 클라이언트가 값을 고를 수
-- 있으면 해시를 무작위로 바꿔가며 우회하므로, 권한 회수와 반드시 같이 가야 한다.

-- 하루·뷰어·서적 단위 중복 제거 원장. 조회수는 이 테이블에 처음 들어온 순간만 오른다.
create table if not exists public.book_view_dedupe (
  book_id     uuid not null references public.books(id) on delete cascade,
  viewer_hash text not null,
  view_date   date not null default current_date,
  primary key (book_id, viewer_hash, view_date)
);

alter table public.book_view_dedupe enable row level security;
-- 정책 없음 = 클라이언트 접근 전면 차단. definer 함수(소유자)만 읽고 쓴다.
revoke all on public.book_view_dedupe from anon, authenticated;

-- 오래된 원장 정리를 위한 인덱스(prune-views cron 이 사용).
create index if not exists book_view_dedupe_date_idx
  on public.book_view_dedupe (view_date);

-- 구버전(1인자) 제거 — 남겨두면 오버로드로 계속 호출 가능해 회수가 무의미해진다.
--
-- ⚠️ 순서 주의: 1인자 버전을 만드는 곳은 0002 와 0009 다. 마이그레이션은 수동 실행이므로
-- **0015 이후에 0009 를 다시 돌리면 anon 에게 열린 취약한 RPC 가 되살아난다.**
-- 0009 를 재실행했다면 이 파일도 다시 실행할 것.
drop function if exists public.record_book_view(uuid);

create or replace function public.record_book_view(p_book_id uuid, p_viewer_hash text)
returns void language plpgsql security definer set search_path = public as $$
declare
  -- ⚠️ GET DIAGNOSTICS ... = ROW_COUNT 는 **정수**를 준다. boolean 으로 받으면
  -- PostgreSQL 에 integer→boolean 캐스트가 없어 런타임 에러가 난다.
  inserted_rows int;
begin
  -- 발행본만 집계한다. 초안 조회로 랭킹이 오르면 안 된다.
  if not exists (
    select 1 from public.books
    where id = p_book_id and status = 'published' and published_at is not null
  ) then
    return;
  end if;

  insert into public.book_view_dedupe (book_id, viewer_hash, view_date)
  values (p_book_id, p_viewer_hash, current_date)
  on conflict do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then return; end if;  -- 오늘 이미 센 뷰어 → 무시

  update public.books set view_count = view_count + 1 where id = p_book_id;

  insert into public.book_view_daily (book_id, view_date, views)
  values (p_book_id, current_date, 1)
  on conflict (book_id, view_date)
    do update set views = public.book_view_daily.views + 1;
end;
$$;

-- 서버(service-role)만 호출한다. definer 함수는 기본적으로 public 에 execute 가 붙으므로
-- 명시적으로 회수해야 한다.
revoke all on function public.record_book_view(uuid, text) from public, anon, authenticated;
grant execute on function public.record_book_view(uuid, text) to service_role;

-- ── 3) 중복 제거 원장 정리 RPC ───────────────────────────────────────────────
-- 원장은 조회 1건당 1행이라 무한히 자란다. 랭킹 최대 윈도가 365일이지만 원장은 당일
-- 중복만 걸러내면 되므로 훨씬 짧게 유지해도 된다.
create or replace function public.prune_view_dedupe(p_keep_days int default 7)
returns int language plpgsql security definer set search_path = public as $$
declare
  deleted int;
begin
  delete from public.book_view_dedupe
    where view_date < current_date - make_interval(days => p_keep_days);
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke all on function public.prune_view_dedupe(int) from public, anon, authenticated;
grant execute on function public.prune_view_dedupe(int) to service_role;
