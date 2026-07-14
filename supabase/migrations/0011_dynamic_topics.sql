-- ============================================================================
-- LogiWiki — 토픽을 DB 로 이전 + AI 자동 생성 설정 (Phase 4)
-- 0001~0010 선행. 멱등 SQL.
--
-- 왜 필요한가: 매일 자동 생성되는 서적의 주제가 기존 14개 토픽에 없을 수 있다.
-- 토픽이 코드 상수(lib/wiki/topics.ts)로 고정돼 있으면 신규 분야를 다룰 수 없으므로
-- DB 테이블로 옮긴다. 코드의 14개는 여기로 시드되고, 이후 앱은 DB 를 읽는다.
--
-- ⚠️ AI 자동 생성은 유료 API(Claude)를 호출한다. ai_settings.enabled 기본값은 false 이고,
--    ANTHROPIC_API_KEY 가 없으면 cron 이 그대로 스킵한다. 켜기 전까지 비용 0.
-- ============================================================================

-- ── 1) 토픽 ──────────────────────────────────────────────────────────────────
create table if not exists public.topics (
  slug        text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{0,38}$'),
  label       text not null check (char_length(label) between 1 and 40),
  description text not null default '' check (char_length(description) <= 200),
  -- Tailwind 정적 리터럴이어야 스캐너가 클래스를 생성한다 → 허용 목록으로 제한.
  accent      text not null default 'text-brand'
              check (accent in ('text-brand','text-brand-2','text-accent-amber',
                                'text-accent-cyan','text-accent-emerald','text-muted-strong')),
  sort_order  int  not null default 1000,
  source      text not null default 'human' check (source in ('human','ai')),
  created_at  timestamptz not null default now()
);

create index if not exists topics_order_idx on public.topics (sort_order, slug);

-- 코드(lib/wiki/topics.ts)의 기존 14개 토픽을 시드한다. 이미 있으면 라벨만 최신화.
insert into public.topics (slug, label, description, accent, sort_order) values
  ('java',       'Java',          '객체지향·JVM·스프링 생태계',        'text-accent-amber',   100),
  ('cpp',        'C++',           '시스템 프로그래밍·메모리·STL',      'text-accent-cyan',    200),
  ('python',     'Python',        '문법·데이터·자동화',                'text-accent-emerald', 300),
  ('javascript', 'JavaScript',    '언어 코어·비동기·브라우저',         'text-accent-amber',   400),
  ('typescript', 'TypeScript',    '타입 시스템·제네릭·설계',           'text-brand',          500),
  ('react',      'React',         '컴포넌트·훅·상태관리',              'text-accent-cyan',    600),
  ('nextjs',     'Next.js',       'App Router·렌더링·풀스택',          'text-brand-2',        700),
  ('nodejs',     'Node.js',       '런타임·서버·패키지',                'text-accent-emerald', 800),
  ('spring',     'Spring',        'DI·MVC·부트·데이터',                'text-accent-emerald', 900),
  ('database',   '데이터베이스',   'SQL·인덱스·트랜잭션·모델링',        'text-accent-cyan',   1000),
  ('algorithm',  '알고리즘',       '자료구조·복잡도·문제풀이',          'text-brand',         1100),
  ('cs',         '컴퓨터 과학',    '운영체제·네트워크·컴퓨터구조',      'text-muted-strong',  1200),
  ('devops',     'DevOps',        'Docker·CI/CD·클라우드',             'text-accent-amber',  1300),
  ('ai',         'AI · 머신러닝',  'ML 기초·딥러닝·LLM 활용',           'text-brand-2',       1400)
on conflict (slug) do update
  set label = excluded.label,
      description = excluded.description,
      accent = excluded.accent,
      sort_order = excluded.sort_order;

-- books.topic 이 실제 토픽을 가리키도록 FK 를 건다(고아 토픽 방지 + 라벨 임베드 가능).
-- 위 시드가 기존 서적의 topic 값을 모두 커버하므로 안전하다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'books_topic_fkey'
  ) then
    alter table public.books
      add constraint books_topic_fkey foreign key (topic)
      references public.topics (slug) on update cascade;
  end if;
end $$;

alter table public.topics enable row level security;

drop policy if exists "topics_select_all" on public.topics;
create policy "topics_select_all" on public.topics for select using (true);

-- 토픽 생성/수정은 관리자만. AI 자동 생성은 service_role(cron)이 하므로 RLS 를 우회한다.
drop policy if exists "topics_write_admin" on public.topics;
create policy "topics_write_admin" on public.topics
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 2) AI 자동 생성 설정(싱글턴) ─────────────────────────────────────────────
create table if not exists public.ai_settings (
  id               boolean primary key default true check (id),  -- 행이 하나뿐임을 강제
  enabled          boolean not null default false,               -- 기본 OFF (유료 API)
  daily_book_count int  not null default 0 check (daily_book_count between 0 and 5),
  language         text not null default 'ko',
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles (id) on delete set null
);

insert into public.ai_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists ai_settings_touch on public.ai_settings;
create trigger ai_settings_touch
  before update on public.ai_settings
  for each row execute function public.touch_updated_at();

alter table public.ai_settings enable row level security;

-- 관리자만 조회·수정. cron 은 service_role 이라 RLS 우회.
drop policy if exists "ai_settings_admin" on public.ai_settings;
create policy "ai_settings_admin" on public.ai_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 3) 오늘 이미 만들어진 AI 서적 수(일일 상한 판정용) ───────────────────────
-- ai_jobs_today() 는 job 기준이라 실패한 job 도 세므로, 실제 생성된 서적 기준 함수를 둔다.
create or replace function public.ai_books_today()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
    from public.books
   where source = 'ai' and created_at::date = current_date;
$$;
