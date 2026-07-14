import "server-only";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { createClient } from "./server";

/**
 * 공개 읽기용 **쿠키 없는** anon 클라이언트.
 *
 * 왜 필요한가 — 두 가지가 같은 원인에서 깨져 있었다:
 *
 * 1) **ISR 무력화.** getReadClient() 는 cookies() 를 만진다. cookies() 는 요청 시점
 *    API 라서, 이걸 호출하는 순간 그 라우트는 dynamic 으로 떨어지고 `export const
 *    revalidate = 60` 이 조용히 무시된다. 홈은 발행된 서적만 읽는데도 매 요청 SSR +
 *    Supabase 왕복 2회를 했다("홈은 60초 ISR" 이라는 주석이 런타임에선 거짓이었다).
 *
 * 2) **after() 안에서 예외.** Next 16 은 Server Component 의 after() 콜백 안에서
 *    cookies()/headers() 호출 시 런타임 에러를 던진다. 조회수 RPC 가 여기서 죽었다.
 *
 * 세션이 필요 없는 읽기(=RLS 상 anon 에게도 보이는 published 데이터)와 security definer
 * 공개 RPC 는 전부 이걸 쓴다. 세션 기반 읽기(내 초안, 추천 여부 등)만 getReadClient().
 */
export function getPublicClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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
