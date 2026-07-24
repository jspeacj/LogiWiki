import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme/context";
import { AuthProvider } from "@/lib/auth/context";
import { siteConfig, NOINDEX, canonical, OG_IMAGES } from "@/lib/site";

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

/**
 * Pretendard 스타일시트 경로. **버전이 경로에 들어 있다.**
 *
 * Vercel 은 public/ 자산을 `max-age=0, must-revalidate` 로 내려준다 → 페이지를 열 때마다
 * 폰트 청크마다 조건부 재검증 왕복이 생겨 셀프호스팅의 이득이 상쇄된다.
 * next.config.ts 에서 /fonts/* 에 1년 immutable 캐시를 걸었고, 그게 안전하려면 파일 내용이
 * 바뀔 때 **경로가 바뀌어야** 한다. Pretendard 를 올릴 때 이 버전과 디렉터리명을 함께 바꾼다.
 */
const PRETENDARD_CSS = "/fonts/pretendard-1.3.9/pretendard.css";

export const metadata: Metadata = {
  // metadataBase 는 origin. per-page canonical 에 /wiki 경로를 지정한다.
  metadataBase: new URL(siteConfig.origin),
  title: {
    default: siteConfig.title,
    template: `%s · ${siteConfig.shortName}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  applicationName: siteConfig.name,
  alternates: { canonical: canonical() },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.ogTitle,
    description: siteConfig.description,
    images: [...OG_IMAGES],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.ogTitle,
    description: siteConfig.description,
    images: [...OG_IMAGES],
  },
  // 임시 운영 동안 색인 차단. 승인 후 NEXT_PUBLIC_NOINDEX=false 로 해제.
  robots: NOINDEX
    ? { index: false, follow: false }
    : {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, "max-image-preview": "large" },
      },
};

export const viewport: Viewport = {
  themeColor: "#07070b",
  width: "device-width",
  initialScale: 1,
};

function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    // <title> 이 브랜드명만 노출하므로, 서술형 명칭을 alternateName 으로 보존(검색 키워드 신호).
    alternateName: siteConfig.ogTitle,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: "ko-KR",
    publisher: {
      "@type": "Organization",
      name: "LogiKit Apps",
      url: siteConfig.origin,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* FOUC 방지: 하이드레이션 전에 저장값/OS설정으로 테마 클래스 교정 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/*
          Pretendard — 셀프호스팅(public/fonts/pretendard/).

          예전엔 cdn.jsdelivr.net 에서 렌더 블로킹 <link rel=stylesheet> 로 받았다.
          preconnect 는 핸드셰이크만 숨길 뿐 블로킹 페치 자체는 못 없앤다 —
          모든 페이지의 크리티컬 패스에 서드파티 왕복이 하나 끼어 있었다.

          동적 서브셋(92청크, unicode-range) 구조는 그대로 가져왔다. 전체 가변 폰트는
          2MB 라 통째로 셀프호스팅하면 오히려 LCP 가 나빠진다 — 브라우저가 실제 쓰는
          글자 조각(청크당 ~40KB)만 받게 두는 편이 훨씬 빠르다.

          ⚠️ basePath 규칙 1: public 자산은 수동으로 /wiki 접두어가 필요하다.
             CSS 안의 url() 은 스타일시트 기준 상대경로라 자동으로 맞는다.
        */}
        <link
          rel="preload"
          as="style"
          href={`${siteConfig.basePath}${PRETENDARD_CSS}`}
        />
        <link
          rel="stylesheet"
          href={`${siteConfig.basePath}${PRETENDARD_CSS}`}
        />
        <StructuredData />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <AuthProvider>
            <div className="relative flex min-h-dvh flex-col">
              {/* 본문 바로가기 — 모바일 챕터 페이지는 목차가 본문보다 먼저 오므로,
                  키보드/스크린리더 사용자가 링크 20개를 지나야 본문에 닿았다. */}
              <a
                href="#content"
                className="sr-only rounded-full bg-brand px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
              >
                본문 바로가기
              </a>
              <div className="pointer-events-none fixed inset-0 -z-10 bg-grid" aria-hidden />
              <Header />
              <main id="content" className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
