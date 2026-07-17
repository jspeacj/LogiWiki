import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next 16 Proxy(구 middleware). 모든 요청에서 Supabase 세션을 갱신한다.
 *
 * basePath(/wiki) 환경에서 matcher·request.nextUrl.pathname 은 /wiki 접두어가 빠진
 * 형태로 매칭된다. 정적 자산·이미지·favicon 은 제외해 불필요한 실행을 막는다.
 *
 * ⚠️ matcher 는 **RSC 네비게이션 요청을 제외할 수 없다** — App Router 의 RSC 요청은
 * `_next/data` 가 아니라 페이지 URL 그 자체로 오기 때문이다(헤더로만 구분된다).
 * 그래서 네비게이션마다 붙는 비용은 여기가 아니라 updateSession 안에서 걷어낸다.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 세션과 무관한 정적 자산은 아예 proxy 를 깨우지 않는다.
     * fonts: Pretendard 는 unicode-range 서브셋 92청크 구조라, 한 페이지가
     *   폰트 요청만 여러 개 만든다. 전부 1년 immutable 로 캐시되는 공개 자산이고
     *   세션과 아무 상관이 없다(next.config.ts headers 참고).
     * woff2/css/txt/xml: 같은 이유. txt/xml 은 robots·sitemap.
     */
    "/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|css|txt|xml)$).*)",
  ],
};
