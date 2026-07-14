import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./server";

/**
 * 읽기 쿼리용 Supabase 클라이언트 (RLS 적용, 현재 세션 권한).
 *
 * 5개 쿼리 모듈(wiki/queries·social·quizzes·rankings, community/queries)이 각자
 * 똑같은 헬퍼를 복붙해 두고 있던 것을 하나로 모았다.
 *
 * env 미설정(로컬에 Supabase 없음) 시 null → 호출부는 빈 결과로 degrade한다.
 * 앱이 로그아웃·빈 상태로라도 뜨게 하려는 의도된 동작이다.
 *
 * ⚠️ 세션이 필요 없는 공개 RPC(조회수 기록 등)는 이걸 쓰지 말 것.
 * after() 콜백처럼 요청 컨텍스트를 벗어난 곳에서는 쿠키 접근이 실패할 수 있다.
 */
export async function getReadClient(): Promise<SupabaseClient | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  return createClient();
}

/** Supabase env 가 설정돼 있는지. */
export function hasSupabaseEnv(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
