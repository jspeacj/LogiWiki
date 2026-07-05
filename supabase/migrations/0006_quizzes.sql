-- ============================================================================
-- LogiWiki — 퀴즈 (객관식/서술형/빈칸코드) + 시도 기록 (Phase 3)
-- 0001_profiles.sql, 0002_books.sql 선행. 멱등 SQL.
-- ⚠️ 정답/해설(answer/explanation)은 채점 전 클라이언트에 도달하면 안 된다.
--    공개 serve 경로는 반드시 컬럼을 제한한다(앱: getRandomQuiz).
-- ============================================================================

create table if not exists public.quizzes (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('mcq', 'short', 'fill_code')),
  topic         text not null,
  difficulty    text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  language      text not null default 'ko',
  prompt        text not null check (char_length(prompt) between 1 and 4000),
  code_template text,                         -- fill_code: ___ 빈칸 포함 스니펫
  choices       jsonb,                        -- mcq: [{"key":"a","text":"..."}]
  answer        text not null,                -- mcq=키 / short·fill=정답
  explanation   text not null default '',
  book_id       uuid references public.books (id) on delete set null,
  chapter_id    uuid references public.chapters (id) on delete set null,
  source        text not null default 'ai' check (source in ('ai','human')),
  status        text not null default 'draft' check (status in ('draft','published','archived')),
  ai_model      text,
  random_key    double precision not null default random(),  -- O(log n) 랜덤 서빙
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.quizzes
  drop constraint if exists quizzes_mcq_choices_chk;
alter table public.quizzes
  add constraint quizzes_mcq_choices_chk
  check (type <> 'mcq' or (choices is not null and jsonb_typeof(choices) = 'array'));

create index if not exists quizzes_serve_idx on public.quizzes (topic, status, random_key);

drop trigger if exists quizzes_touch_updated_at on public.quizzes;
create trigger quizzes_touch_updated_at
  before update on public.quizzes
  for each row execute function public.touch_updated_at();

-- 랜덤 서빙: random_key >= random() 시크 + wrap-around. 정답/해설은 제외해 반환.
create or replace function public.random_quiz(p_topic text, p_difficulty text default null)
returns table (
  id uuid, type text, topic text, difficulty text, language text,
  prompt text, code_template text, choices jsonb
)
language sql stable set search_path = public as $$
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

-- 시도 기록(로그인 사용자만). 비회원 채점은 휘발성.
create table if not exists public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.quizzes (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  submitted  text not null,
  is_correct boolean,
  score      numeric,
  feedback   text,
  graded_by  text check (graded_by in ('auto','ai','human')),
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_idx on public.quiz_attempts (user_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.quizzes       enable row level security;
alter table public.quiz_attempts enable row level security;

-- 퀴즈: published 는 공개(단, 정답 컬럼은 앱에서 serve 시 제외), 그 외 관리자.
drop policy if exists "quizzes_select_pub" on public.quizzes;
create policy "quizzes_select_pub" on public.quizzes
  for select using (status = 'published' or public.is_admin());

-- 작성: 관리자(AI/사람 무관) 또는 로그인 사용자(사람 저작).
drop policy if exists "quizzes_write" on public.quizzes;
create policy "quizzes_write" on public.quizzes
  for all
  using (public.is_admin() or (source = 'human' and auth.uid() is not null))
  with check (public.is_admin() or (source = 'human' and auth.uid() is not null));

-- 시도: 본인 것만.
drop policy if exists "quiz_attempts_own" on public.quiz_attempts;
create policy "quiz_attempts_own" on public.quiz_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
