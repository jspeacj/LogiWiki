import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * 서버 컴포넌트/액션용 인증 조회.
 * Supabase env 미설정이면 null 을 반환한다(로컬에서 Supabase 없이도 500 대신
 * 인증 게이트 페이지가 /login 으로 우아하게 리다이렉트되도록).
 * env 가 있으면 { user(로그인 없으면 null), supabase } 를 반환한다.
 */
export async function getServerAuth(): Promise<
  { user: User | null; supabase: SupabaseClient } | null
> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}
