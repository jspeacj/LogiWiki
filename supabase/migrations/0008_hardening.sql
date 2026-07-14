-- ============================================================================
-- LogiWiki — 보안 하드닝 (Phase 3 후속)
-- 0001~0007 선행 필요. 멱등 SQL.
--
-- 이 마이그레이션이 막는 것(모두 "앱 코드로만 지켜지던" 규칙을 DB 에서 강제):
--   1) 퀴즈 정답/해설이 anon 키 + PostgREST 직접 호출로 노출되던 문제
--      (RLS 는 행만 거른다 — 컬럼은 GRANT 로 막아야 한다)
--   2) 저자가 자기 서적/게시글의 view_count·recommend_count 를 직접 UPDATE 해
--      랭킹을 조작할 수 있던 문제(denormalized 카운터는 트리거/RPC 소유)
--   3) 로그인 사용자가 타인의 human 퀴즈를 수정·삭제·발행할 수 있던 문제
--   4) AI 채점 남용(로그인 사용자 시도 횟수 제한)
-- ============================================================================

-- ── 1) 퀴즈 정답 컬럼 차단(컬럼 레벨 GRANT) ──────────────────────────────────
-- RLS 정책은 "어떤 행" 만 통제한다. 정답 컬럼을 못 읽게 하려면 GRANT 를 좁혀야 한다.
-- 채점은 서버(service_role)에서만 answer/explanation 을 읽는다 → lib/wiki/quizzes.ts
revoke select on public.quizzes from anon, authenticated;
grant select (
  id, type, topic, difficulty, language, prompt, code_template, choices,
  book_id, chapter_id, source, status, ai_model, created_at, updated_at
) on public.quizzes to anon, authenticated;

-- 공개 서빙 RPC 는 소유자 권한으로 실행(위 컬럼 제한과 무관하게 동작하되,
-- 반환 컬럼 목록에 정답이 없다). status='published' 필터는 함수 내부에 이미 있다.
create or replace function public.random_quiz(p_topic text, p_difficulty text default null)
returns table (
  id uuid, type text, topic text, difficulty text, language text,
  prompt text, code_template text, choices jsonb
)
language sql stable security definer set search_path = public as $$
  select id, type, topic, difficulty, language, prompt, code_template, choices from (
    (select * from public.quizzes q
       where q.topic = p_topic and q.status = 'published'
         and (p_difficulty is null or q.difficulty = p_difficulty)
         and q.random_key >= random()
       order by q.random_key limit 1)
    union all
    (select * from public.quizzes q
       where q.topic = p_topic and q.status = 'published'
         and (p_difficulty is null or q.difficulty = p_difficulty)
       order by q.random_key limit 1)  -- wrap-around
  ) picked
  limit 1;
$$;

-- 퀴즈 쓰기는 관리자 전용. (기존 정책은 로그인 사용자면 누구나 source='human' 퀴즈를
--  insert/update/delete 할 수 있어, 타인 퀴즈 삭제·임의 발행이 가능했다.)
drop policy if exists "quizzes_write" on public.quizzes;
create policy "quizzes_write" on public.quizzes
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 2) denormalized 카운터 변조 방지 ─────────────────────────────────────────
-- books/posts 의 UPDATE 정책은 "저자 본인" 이면 통과시키므로, 저자가 PostgREST 로
-- view_count 를 직접 올릴 수 있었다. 카운터는 트리거/RPC(=security definer, 소유자
-- 권한으로 실행) 만 건드릴 수 있어야 한다.
--
-- 판별 방식: 이 트리거는 SECURITY INVOKER 라서 current_user 가
--   - PostgREST 직접 호출  → 'anon' | 'authenticated'  (차단 대상)
--   - security definer RPC/트리거 내부 → 함수 소유자(postgres) (통과)
--   - service_role 클라이언트 → 'service_role'          (통과, 서버 전용)
-- 로 갈린다. 관리자(is_admin)는 예외.
create or replace function public.guard_book_managed_columns()
returns trigger language plpgsql set search_path = public, auth as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    new.view_count      := old.view_count;
    new.recommend_count := old.recommend_count;
    new.author_id       := old.author_id;
    new.source          := old.source;
    -- 최초 발행 시각은 1회만 설정된다(enforce_book_publish 가 채움). 이후 조작 불가.
    if old.published_at is not null then
      new.published_at := old.published_at;
    end if;
  end if;
  return new;
end;
$$;

-- 이름 순서 주의: BEFORE UPDATE 트리거는 이름 오름차순으로 실행된다.
-- books_enforce_publish(e) → books_guard_columns(g) 순서라, 최초 발행 시
-- enforce 가 채운 published_at 을 guard 가 보존한다(old 가 null 이므로 덮어쓰지 않음).
drop trigger if exists books_guard_columns on public.books;
create trigger books_guard_columns
  before update on public.books
  for each row execute function public.guard_book_managed_columns();

create or replace function public.guard_post_managed_columns()
returns trigger language plpgsql set search_path = public, auth as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    new.view_count := old.view_count;
    new.author_id  := old.author_id;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_guard_columns on public.posts;
create trigger posts_guard_columns
  before update on public.posts
  for each row execute function public.guard_post_managed_columns();

-- ── 3) 퀴즈 채점(AI) 남용 방지 ───────────────────────────────────────────────
-- 로그인 사용자: 시간당 60회. 비로그인은 시도 기록이 없으므로 앱 레벨(IP)에서 제한한다.
create or replace function public.enforce_quiz_attempt_rate_limit()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  recent_count int;
begin
  if public.is_admin() then return new; end if;

  select count(*) into recent_count from public.quiz_attempts
    where user_id = new.user_id and created_at > now() - interval '1 hour';
  if recent_count >= 60 then
    raise exception 'RATE_LIMITED: 시간당 채점 한도를 초과했습니다.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists quiz_attempts_rate_limit on public.quiz_attempts;
create trigger quiz_attempts_rate_limit
  before insert on public.quiz_attempts
  for each row execute function public.enforce_quiz_attempt_rate_limit();
