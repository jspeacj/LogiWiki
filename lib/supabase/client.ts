"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
 *
 * 인증 폼·OAuth·실시간 갱신 등 클라이언트에서 직접 호출할 때 사용한다.
 * 세션을 쿠키에 저장하므로 서버 컴포넌트/액션이 같은 세션을 읽을 수 있다(@supabase/ssr).
 *
 * 환경변수가 없으면(로컬에서 Supabase 미설정 시) 예외를 던진다. 표시용
 * AuthProvider 는 이 생성을 try/catch 로 감싸 로그아웃 상태로 우아하게 degrade 한다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
