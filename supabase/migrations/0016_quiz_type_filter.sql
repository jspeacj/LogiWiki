-- 0016_quiz_type_filter — random_quiz 에 유형(type) 필터 추가
--
-- 왜 필요한가
-- ────────────────────────────────────────────────────────────────────────────
-- 서술형(short)·빈칸코드(fill_code) 채점에는 Claude API 가 필요한데(lib/ai/grade.ts)
-- 이 서비스는 ANTHROPIC_API_KEY 를 쓰지 않는다(AGENTS.md — daily-quiz 는 객관식만 만든다).
-- 그런데 random_quiz 는 status 만 보고 뽑아서, 채점할 수 없는 문항이 출제될 수 있었다.
--
-- 실제로 seed.sql 이 react 토픽에 short·fill_code 를 status='published' 로 넣는다.
-- 그 DB 에서는 /quiz/react 가 3번 중 2번 채점 불가 문항을 냈다. 사용자는 답을 제출하고
-- "자동 채점을 일시적으로 사용할 수 없습니다" 를 받는다 — 심사관이 눌러 보고 깨지는
-- 기능은 그 자체로 감점이라는 AGENTS.md 규칙에 정면으로 걸린다.
--
-- 왜 'mcq' 를 DB 에 박지 않는가
-- ────────────────────────────────────────────────────────────────────────────
-- 채점 가능 여부는 **런타임 상태**(API 키 유무)이지 데이터의 성질이 아니다. DB 가 정책을
-- 알면 키를 붙인 뒤에도 마이그레이션을 또 돌려야 한다. 그래서 여기선 필터 수단만 주고,
-- 무엇을 낼지는 앱이 정한다(lib/wiki/quizzes.ts 가 키 유무를 보고 p_type 을 넘긴다).
-- → 키를 넣는 순간 서술형이 자동으로 되살아난다. DB 작업 불필요.
--
-- 데이터는 건드리지 않는다: 기존 short/fill_code 행을 내리지 않아도 필터가 막는다.
-- 나중에 키가 생기면 그대로 다시 출제된다.

-- ⚠️ 구버전 2인자 시그니처를 반드시 DROP 한다.
-- p_type 에 default 를 주면 random_quiz(text, text) 호출이 신·구 양쪽에 매칭돼
-- PostgreSQL 이 오버로드 모호성(42725)으로 거부한다 — 0010 에서 top_books 로 겪은 그것.
drop function if exists public.random_quiz(text, text);

create or replace function public.random_quiz(
  p_topic text,
  p_difficulty text default null,
  p_type text default null   -- null = 전체 유형
)
returns table (
  id uuid, type text, topic text, difficulty text, language text,
  prompt text, code_template text, choices jsonb
)
language sql stable security definer set search_path = public as $$
  select id, type, topic, difficulty, language, prompt, code_template, choices from (
    (select * from public.quizzes q
       where q.topic = p_topic and q.status = 'published'
         and (p_difficulty is null or q.difficulty = p_difficulty)
         and (p_type is null or q.type = p_type)
         and q.random_key >= random()
       order by q.random_key limit 1)
    union all
    (select * from public.quizzes q
       where q.topic = p_topic and q.status = 'published'
         and (p_difficulty is null or q.difficulty = p_difficulty)
         and (p_type is null or q.type = p_type)
       order by q.random_key limit 1)  -- wrap-around
  ) picked
  limit 1;
$$;
