import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme/context";
import { AuthProvider } from "@/lib/auth/context";
import { siteConfig, NOINDEX, canonical } from "@/lib/site";

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
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.ogTitle,
    description: siteConfig.description,
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
        {/* 폰트 CDN 조기 연결 — DNS+TLS 핸드셰이크를 크리티컬 패스에서 미리 수행해 LCP 단축 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
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
