/**
 * LogiWiki — zone 전역 설정.
 *
 * 멀티존 규칙(메인 repo MIGRATION.md):
 * - metadataBase 는 origin(https://logikitapps.com)으로 둔다.
 * - per-page canonical 은 `/wiki/...` 전체 경로 문자열로 지정한다.
 * - 임시 *.vercel.app 운영 동안에는 NOINDEX=true 로 색인을 막는다.
 *   (AdSense 승인 + /wiki 연결 시 NEXT_PUBLIC_NOINDEX=false 로 해제)
 */

export const ORIGIN = "https://logikitapps.com";
export const BASE_PATH = "/wiki";

/** 정본(canonical) 홈 URL */
export const SITE_URL = `${ORIGIN}${BASE_PATH}`;

/**
 * 색인 차단 플래그. 기본값 true(=noindex).
 * 메인 연결·승인 후 Vercel env 에 NEXT_PUBLIC_NOINDEX=false 를 설정해 해제한다.
 */
export const NOINDEX = process.env.NEXT_PUBLIC_NOINDEX !== "false";

export const siteConfig = {
  name: "LogiWiki",
  shortName: "LogiWiki",
  origin: ORIGIN,
  basePath: BASE_PATH,
  url: SITE_URL,
  // 브라우저 탭/메타 <title> 기본값 — 브랜드명만 노출.
  title: "LogiWiki",
  // 소셜/검색 미리보기용 서술형 제목(<title> 와 별개로 키워드 신호 유지).
  ogTitle: "LogiWiki — IT 개념·언어 학습 서적 & 코딩 퀴즈",
  description:
    "Java·C++·JavaScript·React·Next.js 등 IT 개념을 서적 형태로 깊이 있게 학습하세요. 검수를 거친 학습 서적과 주제별 랜덤 퀴즈를 무료로 제공합니다.",
  keywords: [
    "IT 학습",
    "프로그래밍 공부",
    "개발 서적",
    "코딩 퀴즈",
    "자바 강의",
    "리액트 학습",
    "Next.js 튜토리얼",
    "programming tutorial",
    "coding quiz",
    "developer learning",
  ],
  locale: "ko_KR",
} as const;

/** 정적 경로용 canonical 헬퍼: `/wiki` + 경로 */
export function canonical(path = ""): string {
  const clean = path.replace(/^\/+/, "");
  return clean ? `${BASE_PATH}/${clean}` : BASE_PATH;
}

/**
 * 동적 라우트에서 슬러그를 못 찾았을 때의 metadata 조각 (book·chapter·topic 공용).
 *
 * ⚠️ `alternates: {}` 가 핵심이다. 생략하면 루트 레이아웃의 canonical(= `/wiki` 홈)을
 * **상속**해서 없는 페이지가 홈을 정본으로 선언한다 — 메인 repo MIGRATION.md 함정 H.
 * 2026-07-24 프로덕션 실측에서 `/wiki/book/<없는슬러그>` 가 실제로
 * `<link rel="canonical" href="https://logikitapps.com/wiki">` 를 내보내고 있었다.
 * metadata 는 세그먼트 간 **얕은 병합**이라, 물려받은 값을 지우려면 빈 객체로 덮어써야 한다.
 *
 * 역할 분담: 매칭되지 않는 경로는 `app/global-not-found.tsx` 가 처리하고(루트 레이아웃을
 * 아예 거치지 않아 오염이 불가능하다), 여기는 **매칭된** 동적 라우트에서 대상이 없을 때다.
 * 이 zone 은 서적이 DB 발행물이라 `generateStaticParams` 가 빈 배열 + ISR 이므로
 * `dynamicParams = false`(함정 G)를 쓸 수 없다 — 쓰면 모든 서적이 404 가 된다.
 */
export const NOT_FOUND_METADATA = {
  robots: { index: false, follow: false },
  alternates: {},
} as const;

/**
 * 인증 redirect(OAuth·비밀번호 재설정 메일)용 런타임 베이스 URL. basePath(/wiki) 포함.
 *
 * 로컬은 `http://localhost:3000/wiki`, 운영은 정본 도메인. 환경변수로 주입한다
 * (Supabase Redirect URLs 허용목록과 정확히 일치해야 함).
 */
export const AUTH_REDIRECT_BASE = (
  process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL
).replace(/\/+$/, "");

/** 인증 redirect 절대 URL 생성: `<base>/경로` */
export function authUrl(path = ""): string {
  const clean = path.replace(/^\/+/, "");
  return clean ? `${AUTH_REDIRECT_BASE}/${clean}` : AUTH_REDIRECT_BASE;
}
