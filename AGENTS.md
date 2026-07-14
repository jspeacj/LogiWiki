# This is NOT the Next.js you know

This version (Next 16) has breaking changes — APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Notable: `middleware` → **`proxy.ts`**, `after()` from `next/server`, async `params`/`searchParams` (Promises), `useActionState`.

---

# LogiWiki — zone 규칙 (`/wiki`)

이 repo는 LogikitApps 멀티존(Next.js Multi-Zones)의 한 zone이다. **AI 초안 + 사람 검수**로 만드는 IT 학습 서적·퀴즈 플랫폼(위키독스 스타일, AI 생성).

- **zone 슬러그**: `/wiki`
- **최종 정본(canonical) 주소**: `https://logikitapps.com/wiki`
- **임시 운영 주소**: `https://<this>.vercel.app/wiki` (AdSense 승인 전까지 **noindex**)
- **구 서브도메인(선택)**: `wiki.logikitapps.com` → 승인 후 308로 `/wiki` 리다이렉트
- **별도 repo + 별도 Vercel + 별도 Supabase**다. 메인(LogikitApps)은 승인 전까지 건드리지 않는다.

> **단일 출처(SSOT)**: 멀티존 전체 맥락·인프라는 메인 repo `C:\VSCode\LogikitApps\MIGRATION.md`가 정본. 충돌 시 그쪽을 따른다.

## 🚨 AdSense 정책: AI 대량 생성 = 최대 리스크

이 플랫폼의 핵심은 AI 생성 서적이지만, **사람 검수 없는 대량 AI 페이지**는 Google의 **"대규모 콘텐츠 남용(scaled content abuse)"** 정책에 걸려 AdSense 거절·색인 제외·트래픽 급락 사유가 된다. 메인 도메인이 심사 중이므로 승인 후 `/wiki` 연결 시 메인 전체가 위험해질 수 있다.

**불변 규칙 — 어떤 AI 콘텐츠도 사람 승인 없이 발행·색인되지 않는다. 3중 강제:**
1. **DB**: `enforce_book_publish` 트리거(AI 소스는 `is_admin()` 만 발행), RLS(비회원엔 published 만).
2. **렌더**: `sitemap.ts` 는 `status='published' AND published_at IS NOT NULL` 만 등록. 비발행은 `robots:{index:false}`.
3. **파이프라인**: AI 생성은 job 큐 + 일일 캡, 결과는 항상 `status='draft'` → 관리자 검수·보강 후 발행.

AI 프롬프트는 "교과서 품질(학습목표→개념→실행가능 예제→함정→요약→연습), 문서 복붙 금지, 버전 특이사항 명시" 로 E-E-A-T 를 확보한다.

## basePath 4규칙 (새 코드 작성 시 필수)

basePath는 `next/link`·`next/router`·`_next` 자산에만 자동 적용된다. 아래는 **수동으로 `/wiki` 접두어** 필요:

1. **정적 자산**(public): `/wiki/img/x.png` (raw `<img>` + `next/image` src 포함)
2. **클라이언트 `fetch('/api/...')`**: `/wiki/api/...` (브라우저 fetch는 basePath 미적용)
3. **raw `<a href="/내부">`**: `/wiki/...` (또는 `<Link>`/`router.push()` — 자동 적용)
4. **새 페이지 SEO**: per-page `alternates.canonical: canonical('경로')`, 공개면 `sitemap.ts`에 등록 / 비공개면 `robots:{index:false}`

## SEO 기본 설정 (`lib/site.ts`)

- `metadataBase = https://logikitapps.com` (**origin**. 경로 넣으면 canonical 이 origin 루트로 떨어짐)
- 페이지별 `alternates.canonical: canonical('/wiki/...')`
- `NOINDEX = process.env.NEXT_PUBLIC_NOINDEX !== "false"` (기본 noindex). 승인 후 env 로 해제.
- `robots.ts`/`sitemap.ts`: NOINDEX 게이트.

## 보안: 3중 방어 + denormalized 카운터

- 모든 쓰기는 **클라 검증 + 서버 액션(Zod) + DB(RLS/트리거/제약)** 3중.
- `books.view_count`/`recommend_count`·`posts.view_count` 는 **트리거/RPC 전용**. RLS UPDATE 정책은 "저자면 통과" 라 컬럼을 가릴 수 없으므로, `guard_*_managed_columns` 트리거(0008)가 non-admin 의 카운터·`author_id`·`published_at` 변경을 OLD 값으로 되돌린다.
- 추천 sync 트리거·view RPC 는 `security definer`(RLS 우회 필요). 위 guard 트리거는 반대로 **invoker** 여야 한다 — `current_user` 로 "PostgREST 직접 호출(anon/authenticated)" 과 "definer 함수 내부(postgres)" 를 구분하기 때문.
- 퀴즈 정답/해설은 채점 전 클라 도달 금지. **RLS 로는 못 막는다(행 단위)** — `quizzes.answer/explanation` 은 컬럼 레벨 GRANT 로 anon/authenticated 에서 제거(0008). 채점은 service-role 로만 정답을 읽는다(`getQuizForGrading`).
- AI 채점은 유료 호출 → IP 레이트리밋(`lib/rate-limit.ts`) + 로그인 사용자 시간당 상한(`quiz_attempts` 트리거).
- cron 엔드포인트는 운영에서 `CRON_SECRET` 없으면 **401**(fail-closed).
- cron/AI 는 service-role 클라(유저세션 없음). `ANTHROPIC_API_KEY`/`SUPABASE_SERVICE_ROLE_KEY` 는 절대 `NEXT_PUBLIC_` 아님.
- **Admin SSOT**: `lib/auth/admin.ts::ADMIN_EMAIL` == DB `public.is_admin()` 이메일. 반드시 동기화.

## 마이그레이션 (신선한 DB, 의존성 순서로 SQL Editor 에 수동 실행)

`supabase/migrations/NNNN_*.sql` — 멱등(`if not exists`/`create or replace`/`drop ... if exists`).
- `0001_profiles` — profiles·is_admin·handle_new_user·닉네임 규칙 (Phase 1, 서적이 의존)
- `0002_books` — books·chapters·발행 트리거·조회수 RPC·레이트리밋 (Phase 1)
- `0003_community` ~ `0007` — 게시판·댓글·추천·랭킹·퀴즈·AI 파이프라인 (Phase 2~3)
- `0008_hardening` — 퀴즈 정답 컬럼 GRANT 차단 + 카운터 변조 방지 트리거 + 채점 레이트리밋 (**필수**)
- `0009_views_fix` — 조회수 일별 롤업 RPC 재적용 + `top_books` security definer + `book_view_daily` 쓰기 차단 (**필수**)
- `0010_rankings_sort` — `top_books` 에 `p_sort`(종합/조회수/추천수) 추가. 3인자 구버전은 DROP(오버로드 모호성 방지)
- `0011_dynamic_topics` — **토픽을 DB 로 이전**(`public.topics`) + AI 자동 생성 설정(`ai_settings`) (**필수**)

## 토픽 SSOT = DB (`public.topics`)

토픽은 더 이상 코드 상수가 아니다. `lib/wiki/topics.ts` 는 **시드 + 폴백**일 뿐이고, 런타임 원천은 DB다(`lib/wiki/topics-db.ts`). AI 자동 생성이 기존에 없던 분야를 다루면 토픽 행을 새로 만들기 때문.

- 서버: `getTopics()` / `getTopicBySlug()` / `topicExists()` (React `cache` — 요청당 1회)
- 클라이언트 컴포넌트는 토픽을 **props 로 주입받는다**(DB 를 직접 못 읽으므로).
- 서적 카드/상세의 라벨은 `books` 조회 시 `topic_ref:topics!books_topic_fkey(label)` 로 조인해 온다(`book.topic_label`).
- 서버 액션의 토픽 검증은 `z.enum` 이 아니라 `topicExists()` + DB FK.
- `accent` 는 Tailwind 정적 리터럴만 허용(DB check 제약) — 스캐너가 클래스를 생성해야 하므로.

## 매일 서적 자동 생성 = GitHub Actions + Claude Code (구독, 과금 0)

**실제로 돌아가는 경로는 이것이다.** `.github/workflows/daily-book.yml` 이 매일 1권을 만든다.

```
cron(KST 06:00)
  → scripts/ai/fetch-context.mjs   기존 토픽·서적 → .ai/context.json  (DB 는 스크립트만 접근)
  → anthropics/claude-code-action  집필 → .ai/book.json  (Max 구독 토큰으로 인증)
  → scripts/ai/insert-book.mjs     엄격 검증 → Supabase 에 status='draft' 삽입
  → 관리자가 /wiki/admin 에서 검수·발행
```

- 인증은 `CLAUDE_CODE_OAUTH_TOKEN`(GitHub Secret, `claude setup-token` 으로 발급, 1년) — **구독 사용량에서 차감, API 종량제 과금 없음.**
- 🚨 **워크플로에 `ANTHROPIC_API_KEY` 를 절대 넣지 말 것.** Claude Code 의 인증 우선순위상 API 키가 OAuth 토큰보다 앞서므로, 존재하면 조용히 종량제로 과금된다.
- 검증 실패(챕터 400자 미만, slug 중복 등) 시 **아무 것도 삽입하지 않고** 워크플로를 실패시킨다. 챕터 삽입이 실패하면 서적도 롤백한다(반쪽짜리 초안 방지).
- 필요한 GitHub Secrets: `CLAUDE_CODE_OAUTH_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## AI 자동 생성 — 유료 API 경로 (사용 안 함, 보존만)

> ⚠️ **이 경로는 현재 비활성이다.** `vercel.json` 의 cron 에서 제거했다(유료 API 를 쓰지 않기 위해). 코드는 그대로 두었으므로, 나중에 AdSense 수익이 API 비용을 감당할 만해지면 `vercel.json` 에 cron 을 되살리고 `ANTHROPIC_API_KEY` 를 넣으면 즉시 동작한다. 관리자 화면의 `ai_settings` 도 이 경로를 위한 것이다.

`/api/ai/generate` 는 **계획 → 생성** 2단계로 동작한다.
1. `ai_settings`(관리자 화면에서 설정) 를 읽어 오늘 만들 권수를 정하고, Claude 에게 주제를 제안받아 job 을 큐에 넣는다(`lib/ai/plan.ts`). 없는 토픽이면 `topics` 행을 새로 만든다(`source='ai'`).
2. pending job 을 claim → 초안 생성 → `books`/`chapters` 삽입.

**결과는 언제나 `status='draft'`. 자동 발행 없음 — 관리자 승인 후에만 발행된다.**

⚠️ **유료 API.** `ANTHROPIC_API_KEY` 가 없거나 `ai_settings.enabled=false` 면 아무 것도 하지 않는다(비용 0). "검색량이 많은 주제"는 실제 검색량 통계가 아니라 **모델의 판단**이다(무료로 얻을 수 있는 검색량 데이터가 없음).

## Vercel cron 제약 (Hobby)

`vercel.json` 의 cron 은 **Hobby 플랜에서 하루 1회까지만** 허용된다. `0 */6 * * *` 처럼 하루 여러 번 도는 표현식은 배포 자체가 실패한다(`Hobby accounts are limited to daily cron jobs`). 주 1회(`0 4 * * 1`)처럼 더 드문 것은 허용된다. 실행 시각도 ±59분 오차가 있다(Hobby).

→ AI job 큐 drain 은 하루 1회. 즉시 돌려야 하면 `Authorization: Bearer $CRON_SECRET` 로 `/wiki/api/ai/generate` 를 직접 호출하면 된다. Pro 로 올리면 분 단위 cron 이 열린다.

## next.config — basePath + 구 서브도메인 308

`basePath: '/wiki'`, `experimental.serverActions.allowedOrigins: ['logikitapps.com','wiki.logikitapps.com']`, `wiki.logikitapps.com` host 308 리다이렉트(도메인 할당 전 자연 비활성).

## 로컬 개발

basePath 때문에 `npm run dev` 후 **`http://localhost:3000/wiki`** 로 접속(루트 `/`는 404).
Supabase env 미설정이어도 앱은 로그아웃·빈 상태로 뜬다(인증/쿼리 계층이 우아하게 degrade).
