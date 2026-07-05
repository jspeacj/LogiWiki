import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * service_role Supabase 클라이언트(서버 전용).
 * cron/AI 파이프라인이 유저 세션 없이 관리자 권한으로 books insert·job 갱신에 쓴다.
 * RLS 를 우회하므로 절대 클라이언트에 노출하지 말 것.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / URL 미설정");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function hasAdminEnv(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
