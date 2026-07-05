import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버(서버 컴포넌트·서버 액션·라우트 핸들러)용 Supabase 클라이언트.
 *
 * RLS 가 적용된 채로 현재 로그인 사용자 권한으로 읽기/쓰기한다.
 * 서버 컴포넌트에서는 쿠키 쓰기가 불가하므로 setAll 실패를 무시한다(세션 갱신은 proxy.ts 가 담당).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서 호출 시 쿠키 쓰기 불가 → 무시.
            // 세션 토큰 갱신은 proxy 가 처리하므로 안전하다.
          }
        },
      },
    },
  );
}
