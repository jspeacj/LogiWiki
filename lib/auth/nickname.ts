import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 닉네임 중복 검사 유틸 (클라이언트/서버 supabase 클라이언트 공용).
 * profiles 는 RLS 상 누구나 select 가능하므로 가입 전(익명)에도 검사할 수 있다.
 * 최종 무결성은 DB 의 lower(nickname) 유니크 인덱스가 보장한다(경쟁 상황 방지).
 */

/** PostgREST ilike 패턴에서 LIKE 특수문자(%, _, \\)를 리터럴로 escape. */
export function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, "\\$&");
}

/** 닉네임이 이미 사용 중인지(대소문자 무시). excludeId 가 주어지면 본인 행은 제외. */
export async function isNicknameTaken(
  supabase: SupabaseClient,
  nickname: string,
  excludeId?: string,
): Promise<boolean> {
  let query = supabase
    .from("profiles")
    .select("id")
    .ilike("nickname", escapeLike(nickname.trim()))
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  return !!(data && data.length > 0);
}
