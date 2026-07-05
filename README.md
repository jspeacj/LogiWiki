# LogiWiki

AI 초안 + 사람 검수로 만드는 **IT 학습 서적 · 코딩 퀴즈** 플랫폼 (위키독스 스타일, AI 생성).
LogiKit Apps 멀티존의 한 zone (`logikitapps.com/wiki`).

## 스택
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · Supabase (@supabase/ssr) · Anthropic Claude (AI 생성/채점) · Vercel 배포.

## 로컬 개발
```bash
npm install
cp .env.example .env.local   # 값 채우기 (Supabase 없이도 앱은 뜬다 — 로그아웃/빈 상태)
npm run dev
```
basePath 때문에 **http://localhost:3000/wiki** 로 접속 (루트 `/` 는 404).

## Supabase 설정
1. 새 프로젝트 생성 → `supabase/migrations/*.sql` 을 번호 순서대로 SQL Editor 에 실행.
2. Auth > URL Configuration 의 Redirect URLs 에 `<SITE_URL>/auth/callback`, `<SITE_URL>/update-password` 등록.
3. (선택) Auth > Providers 에서 Google 활성화 → 관리자 계정 로그인.
4. (선택) `supabase/seed.sql` 로 데모 서적 생성(가입해 프로필이 생긴 뒤 실행).

## 환경변수
`.env.example` 참고. 서버 전용 키(`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`)는 절대 `NEXT_PUBLIC_` 접두어를 붙이지 않는다.

## 핵심 원칙
- **AdSense 안전**: AI 콘텐츠는 항상 `draft` 로 생성 → 관리자 검수·승인 후에만 발행·색인. (DB 트리거 + RLS + sitemap 게이트 3중)
- **noindex 기본**: 임시 `*.vercel.app` 운영 동안 색인 차단. 승인 후 `NEXT_PUBLIC_NOINDEX=false`.
- 자세한 규칙은 [`AGENTS.md`](./AGENTS.md).

## 진행 상황
- ✅ Phase 1 — 골격 · 서적 열람 · SEO · 테마 (0001~0002 마이그레이션)
- ⏳ Phase 2 — 인증 · 자유게시판 · 서적 댓글 · 추천
- ⏳ Phase 3 — 랭킹 · 퀴즈 · AI 생성 파이프라인
