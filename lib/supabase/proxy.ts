import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 요청마다 Supabase 세션을 갱신하고 쿠키를 재설정한다.
 *
 * Next 16 의 proxy(구 middleware)에서 호출한다. getUser() 를 호출해 만료 임박 토큰을
 * 갱신하고, 갱신된 쿠키를 응답에 실어 브라우저·서버 컴포넌트가 같은 세션을 보게 한다.
 * (Supabase Next.js 권장 패턴)
 *
 * env 미설정 시엔 그대로 통과시켜 로컬에서 Supabase 없이도 앱이 뜨게 한다.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() 가 토큰을 검증·갱신한다. proxy 와 서버 컴포넌트 사이 세션 누락을 막으려면 반드시 호출.
  await supabase.auth.getUser();

  return response;
}
