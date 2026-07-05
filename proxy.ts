import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next 16 Proxy(구 middleware). 모든 요청에서 Supabase 세션을 갱신한다.
 *
 * basePath(/wiki) 환경에서 matcher·request.nextUrl.pathname 은 /wiki 접두어가 빠진
 * 형태로 매칭된다. 정적 자산·이미지·favicon 은 제외해 불필요한 실행을 막는다.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
