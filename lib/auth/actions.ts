import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";

/**
 * 서버 액션 공용 헬퍼 (SSOT).
 *
 * 5개 액션 파일(wiki·wiki-admin·book-social·community·account)에 byte-단위로 복붙돼 있던
 * requireUser/requireAdmin/isRateLimited 를 하나로 모은다.
 *
 * 서버 액션은 UI 가 아니라 **공개 HTTP 엔드포인트**다 — 로그인/권한을 여기서 게이트한 뒤
 * DB(RLS·트리거)가 최종 강제한다(3중 방어의 서버 계층). 특히 발행·타인 콘텐츠 변경 같은
 * 관리자 작업은 requireAdmin 을, 본인 명의 쓰기는 requireUser 를 반드시 통과해야 한다.
 */

/** 폼 액션 반환 상태(useActionState) 기본형. 파일별 변형은 이걸 확장한다. */
export type ActionState = {
  ok?: boolean;
  error?: string;
};

/** 인증된 세션(현재 사용자 권한의 클라이언트 + 사용자). */
export type Session = { supabase: SupabaseClient; user: User };

/** 로그인 사용자 세션 반환, 없으면 null. */
export async function requireUser(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

/**
 * 관리자 세션 반환, 아니면 null.
 *
 * 표시 분기가 아니라 실제 권한 게이트다 — ADMIN_EMAIL(=DB public.is_admin() 과 동일 이메일)로
 * 판별한다. 관리자 UI 를 숨긴 것만으로는 공개 엔드포인트를 막지 못하므로, 발행·검수 등 모든
 * 관리자 mutation 이 이 게이트를 통과한 뒤 DB 트리거(0013 등)가 한 번 더 강제한다.
 */
export async function requireAdmin(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return { supabase, user };
}

/** DB rate-limit 트리거가 던진 예외인지 판별(에러 메시지에 RATE_LIMITED 포함). */
export function isRateLimited(
  error: { message?: string } | null | undefined,
): boolean {
  return !!error?.message?.includes("RATE_LIMITED");
}
