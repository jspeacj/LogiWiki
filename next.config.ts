import type { NextConfig } from "next";

// Multi-Zones: 이 앱은 logikitapps.com/wiki 하위 경로로 서빙된다.
// basePath는 next/link·next/router·_next 자산에만 자동 적용된다.
// 정적 자산·클라이언트 fetch·raw <a href>·canonical은 수동으로 /wiki 접두어 필요.
// (자세한 규칙은 AGENTS.md, 메인 repo MIGRATION.md 참고)
const nextConfig: NextConfig = {
  basePath: "/wiki",

  // 챕터 본문 렌더(lib/wiki/markdown.ts)가 쓰는 두 패키지는 번들링에서 제외한다.
  // shiki 는 문법/테마를 동적 import 로 로드하고, isomorphic-dompurify 는 jsdom 을
  // 동적 require 로 끌어온다. 번들러가 이 동적 참조를 추적하지 못해 서버리스 런타임에서
  // 모듈 로드가 통째로 실패했고, 그 결과 챕터 라우트가 데이터와 무관하게 500 이 났다.
  // (존재하지 않는 slug 로 요청해도 500 → 모듈 초기화 단계의 실패라는 증거)
  serverExternalPackages: ["shiki", "isomorphic-dompurify"],

  // 서버 액션(서적·게시글·댓글 작성 등)은 멀티존 정본 도메인에서 호출된다.
  // basePath rewrite 환경에서 Origin 검증을 통과시키려면 허용 오리진을 명시한다.
  experimental: {
    serverActions: {
      allowedOrigins: ["logikitapps.com", "wiki.logikitapps.com"],
    },
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
