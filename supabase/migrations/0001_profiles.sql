-- ============================================================================
-- LogiWiki — 인증/프로필 기반 (Phase 1)
-- Supabase 대시보드 > SQL Editor 에 붙여넣어 실행한다.
-- (profiles + 가입 트리거 + is_admin + updated_at 헬퍼 + 닉네임 규칙 + RLS)
--
-- 멱등: create ... if not exists / create or replace / drop ... if exists.
-- 서적(0002)·게시판(0003+)·추천·퀴즈·AI 파이프라인이 이 파일의 profiles/is_admin 에 의존한다.
-- ============================================================================

-- ── 1) 프로필 ────────────────────────────────────────────────────────────────
-- auth.users 와 1:1. 닉네임은 서적 저자·댓글·게시판에서 작성자로 노출된다.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 닉네임은 대소문자 무시로 유일해야 한다(검색 인덱스 겸용).
create unique index if not exists profiles_nickname_lower_key
  on public.profiles (lower(nickname));

-- ── 2) updated_at 자동 갱신 헬퍼 ─────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 3) 관리자 판별 ───────────────────────────────────────────────────────────
-- 관리자 이메일은 코드(lib/auth/admin.ts ADMIN_EMAIL)와 반드시 일치시킨다.
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public, auth as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and lower(email) = 'jspeacj@gmail.com'
  );
$$;

-- ── 4) 예약 닉네임 판별 ──────────────────────────────────────────────────────
-- 브랜드/역할 사칭 방지. 관리자만 사용 가능하며, 그 외엔 가입 트리거가 랜덤으로 대체하고
-- 프로필 수정 트리거가 거부한다.
create or replace function public.is_reserved_nickname(nick text)
returns boolean language sql immutable as $$
  select nick ~* '(logiwiki|logikit|admin|administrator|모더레이터|moderator|운영자|관리자|official|system|root)';
$$;

-- ── 5) 가입 시 프로필 자동 생성 ──────────────────────────────────────────────
--  - 이메일 가입: 메타데이터(nickname) 사용.
--  - OAuth(Google 등): nickname 메타데이터가 없으므로 랜덤 닉네임(실명 노출 방지).
--  - 예약어는 관리자만, 충돌 시 대소문자 무시로 suffix 부여.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_nick text;
  final_nick text;
  suffix int := 0;
begin
  base_nick := nullif(new.raw_user_meta_data ->> 'nickname', '');

  if base_nick is null then
    base_nick := 'user_' || substr(md5(random()::text || new.id::text), 1, 8);
  end if;

  -- 예약 닉네임은 관리자만 허용. 그 외엔 랜덤으로 대체.
  if public.is_reserved_nickname(base_nick)
     and lower(new.email) <> 'jspeacj@gmail.com' then
    base_nick := 'user_' || substr(md5(random()::text || new.id::text), 1, 8);
  end if;

  base_nick := left(base_nick, 20);
  final_nick := base_nick;

  while exists (select 1 from public.profiles where lower(nickname) = lower(final_nick)) loop
    suffix := suffix + 1;
    final_nick := left(base_nick, 15) || '_' || floor(random() * 9000 + 1000)::int;
    if suffix > 5 then
      final_nick := left(base_nick, 13) || '_' || substr(new.id::text, 1, 6);
      exit;
    end if;
  end loop;

  insert into public.profiles (id, nickname, avatar_url)
  values (new.id, final_nick, new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 6) 닉네임 변경 하드닝(정보보안: RLS UPDATE 는 id 만 검사하므로 DB 에서도 강제) ──
-- 브라우저 클라이언트가 서버 액션을 우회해 직접 update({nickname}) 해도
-- 길이/예약어 규칙이 DB 에서 적용되도록 한다.
create or replace function public.enforce_profile_nickname()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if new.nickname is distinct from old.nickname then
    if char_length(new.nickname) < 2 or char_length(new.nickname) > 20 then
      raise exception 'NICKNAME_LENGTH' using errcode = 'P0001';
    end if;
    if public.is_reserved_nickname(new.nickname) and not public.is_admin() then
      raise exception 'NICKNAME_RESERVED' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_nickname on public.profiles;
create trigger profiles_enforce_nickname
  before update on public.profiles
  for each row execute function public.enforce_profile_nickname();

-- ── 7) RLS ───────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
