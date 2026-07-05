/**
 * 관리자 식별 (SSOT).
 *
 * 관리자 권한은 이메일로 판별한다. 관리자 계정은 Google OAuth 로 로그인한다.
 * 클라이언트 표시 분기에 쓰되, 실제 권한(AI 서적 발행·서적 검수·타인 글/댓글 삭제)은
 * 서버 액션 + DB RLS(public.is_admin())가 최종 강제한다.
 *
 * DB 측 판별 함수와 반드시 같은 이메일을 본다:
 * supabase/migrations 의 public.is_admin().
 */

export const ADMIN_EMAIL = "jspeacj@gmail.com";

/** 주어진 이메일이 관리자인지(대소문자 무시). */
export function isAdminEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL;
}
