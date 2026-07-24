import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ORIGIN, BASE_PATH, siteConfig } from "@/lib/site";
import { THEME_INIT_SCRIPT } from "@/lib/theme/context";

/**
 * 전역 404 (`experimental.globalNotFound`).
 *
 * 루트 레이아웃을 **거치지 않고** 완전한 HTML 문서를 직접 반환한다 — 그래서 `<html>`·`<body>` 를
 * 여기서 쓴다. 이유는 메인 repo MIGRATION.md 함정 H: 기본 404 는 루트 레이아웃 **안에서**
 * 렌더돼 404 응답에 루트 메타데이터가 그대로 실린다 — 없는 URL 이 `/wiki` 를 canonical 로
 * 선언하고, `index, follow` 와 Next 가 넣는 noindex 가 동시에 존재하며, `WebSite` JSON-LD 와
 * og:url 까지 홈의 것이 실린다.
 *
 * `app/not-found.tsx` 로는 못 고친다 — not-found 는 metadata 를 export 할 수 없다(Next 문서).
 * 그 파일은 세그먼트 안에서 `notFound()` 가 호출될 때의 **UI** 로 계속 쓰인다(이 zone 은
 * 서적·챕터·토픽에서 notFound() 를 부른다). 여기는 **매칭되지 않는 경로** 담당이다.
 *
 * ⚠️ 함정 O — 루트 레이아웃의 것을 **아무것도 상속하지 않는다.** metadataBase, 테마 스크립트,
 * 폰트, lang, suppressHydrationWarning 을 전부 여기서 다시 넣어야 한다. 형제 zone 은
 * metadataBase 가 빠져 OG URL 이 localhost 로 굳었고, 테마 스크립트가 빠져 404 만 검은 화면으로 튀었다.
 *
 * ⚠️ 내부 링크는 `/wiki/...` 로 적는다 — next/link 를 쓰지 않으므로 basePath 자동 적용이 없다
 * (basePath 규칙 3). 허브 페이지는 basePath 밖이라 절대 URL 이어야 한다.
 *
 * ⚠️ OG 이미지는 지정하지 않는다 — 이 zone 은 `opengraph-image` 를 두지 않는 것이 규약이라
 * (MIGRATION.md 함정 F 의 예외 항목) 지정할 대상이 없다. noindex 페이지라 영향도 없다.
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/** 루트 레이아웃과 같은 값을 쓴다 — 어긋나면 404 만 폰트가 폴백으로 튄다. */
const PRETENDARD_CSS = "/fonts/pretendard-1.3.9/pretendard.css";

export const metadata: Metadata = {
  // 루트 레이아웃을 거치지 않으므로 metadataBase 를 여기서 다시 준다(없으면 localhost 로 해석).
  metadataBase: new URL(ORIGIN),
  title: `페이지를 찾을 수 없습니다 · ${siteConfig.shortName}`,
  description: "요청하신 주소에 해당하는 페이지가 없습니다.",
  // 404 는 어떤 상황에서도 색인 대상이 아니다(NEXT_PUBLIC_NOINDEX 와 무관하게 고정).
  robots: { index: false, follow: false },
};

const LINKS = [
  { href: BASE_PATH, label: "LogiWiki 홈", desc: "학습 서적 · 코딩 퀴즈" },
  { href: `${BASE_PATH}/books`, label: "학습 서적", desc: "언어·개념별 목차" },
  { href: `${BASE_PATH}/quiz`, label: "코딩 퀴즈", desc: "주제별 랜덤 문제" },
  { href: ORIGIN, label: "LogiKit 홈", desc: "다른 서비스 둘러보기" },
];

export default function GlobalNotFound() {
  return (
    /*
     * className 의 "dark" 는 스크립트가 실행되기 전의 기본값이다. 루트 레이아웃과 같은 테마
     * 스크립트를 써서 저장값을 따르게 한다 — 하드코딩하면 라이트 사용자가 404 에서만
     * 검은 화면으로 튄다(함정 O·P).
     */
    <html
      lang="ko"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* basePath 규칙 1 — public 자산은 수동으로 /wiki 접두어가 필요하다. */}
        <link rel="stylesheet" href={`${BASE_PATH}${PRETENDARD_CSS}`} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16">
          <p className="font-mono text-sm tracking-[0.2em] text-muted">404</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            페이지를 찾을 수 없습니다
          </h1>
          <p className="mt-4 leading-relaxed text-muted-strong">
            주소가 바뀌었거나, 아직 발행되지 않은 서적일 수 있습니다. 아래에서 이동하세요.
          </p>

          <nav className="mt-10 grid gap-2" aria-label="주요 페이지">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="flex items-baseline justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
              >
                <span className="font-medium">{l.label}</span>
                <span className="text-sm text-muted">{l.desc}</span>
              </a>
            ))}
          </nav>

          <p className="mt-10 text-sm text-muted">
            <a
              href={`${BASE_PATH}/contact`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              문의하기
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
