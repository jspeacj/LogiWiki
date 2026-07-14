-- 0013_publish_admin_only.sql  (**필수**)
--
-- 발행(published)은 **소스와 무관하게 관리자만**. INSERT 경로까지 막는다.
--
-- 무엇이 뚫려 있었나 (실재하는 취약점, 2개 경로):
--
--   (A) 서버 액션 경로
--       app/actions/wiki.ts 의 createBook/upsertChapter/setBookStatus 는 로그인만
--       확인했다. 서버 액션은 UI 가 아니라 **공개 HTTP 엔드포인트**이므로, 관리자
--       화면을 숨긴 것만으로는 막히지 않는다. 아무나 가입해서
--         createBook(source='human' 강제, author_id = 본인)
--         → upsertChapter(마크다운 20만자)
--         → setBookStatus(id, 'published')
--       를 호출하면 RLS(books_update_own: 저자면 통과)도, 발행 트리거(source='ai'
--       일 때만 차단)도 통과해 홈·서적목록·랭킹·sitemap 에 즉시 게시됐다.
--
--   (B) PostgREST 직접 INSERT 경로 — 더 나쁘다
--       books_enforce_publish 와 books_guard_columns 는 둘 다 `before update` 전용이고,
--       books_insert_own RLS 에는 status 제약이 없었다. 따라서 authenticated 롤이
--       anon 키로 곧장
--         POST /rest/v1/books
--         { author_id: <본인>, source: 'human', status: 'published',
--           published_at: now(), view_count: 999999, title: '...' }
--       를 던지면 **트리거를 아예 타지 않고** 발행 상태로 행이 만들어졌다. 조회수·
--       추천수도 임의값으로 넣어 랭킹을 조작할 수 있었다.
--
-- "어떤 콘텐츠도 사람 승인 없이 발행·색인되지 않는다"(AGENTS.md 불변 규칙)가 통째로
-- 뚫리는 경로였다. AdSense 관점에서는 외부인이 우리 도메인에 스팸을 색인시킬 수 있다는
-- 뜻이기도 하다.
--
-- 앱 쪽(app/actions/wiki.ts)도 관리자 전용으로 좁혔지만, DB 가 최종 방어선이어야 한다.
--
-- 멱등: create or replace / drop ... if exists.

-- ── 1) 발행 트리거: INSERT 까지 커버 + 소스 무관 관리자 전용 ──────────────────
create or replace function public.enforce_book_publish()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  was_published boolean := false;
begin
  -- INSERT 에는 OLD 가 없다. TG_OP 로 분기하지 않으면 참조 시 에러가 난다.
  if tg_op = 'UPDATE' then
    was_published := (old.status = 'published');
  end if;

  if new.status = 'published' and not was_published then
    -- source(ai/human) 무관: 발행은 언제나 관리자만.
    if not public.is_admin() then
      raise exception 'PUBLISH_FORBIDDEN' using errcode = 'P0001';
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
  before insert or update on public.books
  for each row execute function public.enforce_book_publish();

-- ── 2) INSERT 시 관리 컬럼 위조 차단 ────────────────────────────────────────
-- 0008 의 guard_book_managed_columns 는 UPDATE 전용이라, INSERT 로 카운터를 심는 건
-- 막지 못했다. 같은 규칙을 INSERT 에도 적용한다.
--
-- ⚠️ security definer 를 붙이지 말 것 — **invoker** 여야 current_user 로
--    "PostgREST 직접 호출(anon/authenticated)" 과 "service_role / 내부 함수" 를 구분할 수 있다.
--    (0008 의 guard 트리거와 동일한 이유. AGENTS.md 참고)
create or replace function public.guard_book_insert_columns()
returns trigger language plpgsql set search_path = public, auth as $$
begin
  if current_user in ('anon', 'authenticated') then
    -- 카운터는 트리거/RPC 소유다. 클라이언트가 심은 초기값은 무시한다.
    new.view_count := 0;
    new.recommend_count := 0;
    -- 발행일은 발행 트리거만 채운다(비관리자는 애초에 published 로 못 들어온다).
    if not public.is_admin() then
      new.published_at := null;
    end if;
  end if;
  return new;
end;
$$;

-- 트리거는 같은 타이밍이면 **이름 알파벳 순**으로 실행된다.
-- books_enforce_publish(e) → books_guard_insert(g) 순 — enforce 가 채운 published_at 을
-- guard 가 되돌리지 않도록(관리자면 is_admin() 이 true 라 통과) 이 순서가 맞다.
drop trigger if exists books_guard_insert on public.books;
create trigger books_guard_insert
  before insert on public.books
  for each row execute function public.guard_book_insert_columns();

-- ── 3) RLS: 비관리자는 draft 로만 생성 가능 ──────────────────────────────────
-- 트리거가 이미 막지만, 정책 자체로도 의도를 못박는다(방어 3겹).
drop policy if exists "books_insert_own" on public.books;
create policy "books_insert_own" on public.books
  for insert with check (
    auth.uid() = author_id
    and (source = 'human' or public.is_admin())
    and (status = 'draft' or public.is_admin())
  );
