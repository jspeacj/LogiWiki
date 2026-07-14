import type { NextConfig } from "next";

// Multi-Zones: 이 앱은 logikitapps.com/wiki 하위 경로로 서빙된다.
// basePath는 next/link·next/router·_next 자산에만 자동 적용된다.
// 정적 자산·클라이언트 fetch·raw <a href>·canonical은 수동으로 /wiki 접두어 필요.
// (자세한 규칙은 AGENTS.md, 메인 repo MIGRATION.md 참고)
const nextConfig: NextConfig = {
  basePath: "/wiki",

  // shiki 는 문법/테마를 동적 import 로 로드하므로 번들링에서 제외한다(외부 모듈로 로드).
  serverExternalPackages: ["shiki"],

  // 서버 액션(서적·게시글·댓글 작성 등)은 멀티존 정본 도메인에서 호출된다.
  // basePath rewrite 환경에서 Origin 검증을 통과시키려면 허용 오리진을 명시한다.
  experimental: {
    serverActions: {
      allowedOrigins: ["logikitapps.com", "wiki.logikitapps.com"],
    },
  },

  /**
   * 보안 헤더.
   *
   * 챕터 본문은 dangerouslySetInnerHTML 로 주입된다(sanitize-html 이 1차 방어).
   * 그 뒤를 받쳐줄 층이 하나도 없었다 — 아래가 그 층이다.
   *
   * ⚠️ CSP 에 script-src 를 넣지 않았다. 이유:
   *   - app/layout.tsx 의 인라인 테마 스크립트와 Next 의 인라인 부트스트랩 때문에
   *     nonce 없이는 'unsafe-inline' 이 강제되고, 그러면 XSS 방어력이 사실상 0 이다.
   *   - 곧 AdSense 스크립트(googlesyndication 등)를 붙여야 하는데, 잘못 조이면
   *     광고가 조용히 안 뜬다.
   *   → script-src 를 제대로 하려면 nonce 를 proxy.ts 에서 주입해야 한다(후속 작업).
   *     그 전까지도 frame-ancestors/object-src/base-uri 는 충분히 값어치를 한다.
   */
  async headers() {
    return [
      {
        /**
         * 셀프호스팅 폰트 — 1년 immutable.
         *
         * Vercel 은 public/ 자산을 기본적으로 `max-age=0, must-revalidate` 로 내려준다.
         * 그러면 페이지를 열 때마다 폰트 청크마다 조건부 재검증 왕복이 생겨(304 라도 RTT 는
         * 그대로다) 셀프호스팅으로 얻은 것을 도로 까먹는다.
         *
         * 경로에 버전이 박혀 있으므로(/fonts/pretendard-1.3.9/...) immutable 이 안전하다.
         * 폰트를 올릴 때는 디렉터리명과 app/layout.tsx 의 PRETENDARD_CSS 를 함께 바꾼다.
         */
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          // 클릭재킹 차단. /admin 의 발행 버튼이 iframe 에 얹혀 클릭당하는 걸 막는다.
          { key: "X-Frame-Options", value: "DENY" },
          // MIME 스니핑 차단(업로드/마크다운 경유 콘텐츠 타입 혼동 방지).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 외부로 새는 리퍼러 최소화.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 쓰지 않는 강력한 권한은 원천 차단.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "frame-ancestors 'none'", // X-Frame-Options 의 현대적 대체
              "object-src 'none'", // 플러그인/embed 차단
              "base-uri 'self'", // <base> 주입으로 상대경로 탈취 차단
              "form-action 'self'", // 폼 전송지 탈취 차단
            ].join("; "),
          },
        ],
      },
    ];
  },

  // 구 서브도메인(wiki.logikitapps.com)으로 들어오는 요청을 308 영구 리다이렉트.
  // 도메인이 zone 프로젝트에 할당되기 전(=AdSense 승인 전)에는 자연히 비활성.
  // basePath:false → '/wiki' 접두어 없이 들어오는 실제 경로를 매칭.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "wiki.logikitapps.com" }],
        destination: "https://logikitapps.com/wiki/:path*",
        permanent: true,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
