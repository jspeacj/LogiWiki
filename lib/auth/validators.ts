/** 클라이언트 폼 검증 헬퍼. */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN = 8;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

export function isValidPassword(v: string): boolean {
  return v.length >= PASSWORD_MIN;
}

export function isValidNickname(v: string): boolean {
  const n = v.trim().length;
  return n >= NICKNAME_MIN && n <= NICKNAME_MAX;
}

/**
 * 어드민 전용 예약어. 닉네임에 브랜드/역할 사칭 단어가 포함되면 어드민만 허용.
 * DB 트리거(public.is_reserved_nickname / handle_new_user / enforce_profile_nickname)와
 * 반드시 동일한 패턴을 유지한다.
 */
export const RESERVED_NICKNAME_RE =
  /(logiwiki|logikit|admin|administrator|모더레이터|moderator|운영자|관리자|official|system|root)/i;

export function hasReservedNickname(v: string): boolean {
  return RESERVED_NICKNAME_RE.test(v.trim());
}
