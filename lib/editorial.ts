/**
 * 편집자·연락처 SSOT.
 *
 * 소개/개인정보처리방침/문의 페이지와 서적 저자 표기가 모두 여기를 참조한다.
 * 값을 바꾸려면 이 파일만 고치면 된다.
 *
 * ⚠️ EDITOR_NAME 은 DB `profiles.nickname` 과 별개 값이다. 서적 카드·상세의 저자 표기는
 *    DB 의 닉네임을 그대로 쓰므로 **둘을 같은 값으로 유지해야** 화면이 일치한다.
 *    관리자 프로필 nickname 은 EDITOR_NAME 에 맞춰 동기화해 두었다(2026-07-17).
 *    EDITOR_NAME 을 바꾸면 Supabase 의 nickname 도 함께 바꿀 것:
 *      update public.profiles p set nickname = '<새 이름>'
 *      from auth.users u where u.id = p.id and lower(u.email) = '<ADMIN_EMAIL>';
 *    (닉네임 제약: 2~20자, is_reserved_nickname 정규식 회피 — 0001_profiles 참고)
 *
 *    챕터 바이라인은 저자명 == EDITOR_NAME 이면 이름을 한 번만 렌더한다
 *    (app/book/[slug]/[chapterSlug]/page.tsx) — 동기화된 상태를 전제로 한 처리다.
 */

/** 서적 편집·감수자 표기명. 실명 — 검색·AdSense 의 E-E-A-T 신호가 가장 강하다. */
export const EDITOR_NAME = "김보성";

/** 문의·개인정보 관련 연락처. */
export const CONTACT_EMAIL = "jspeacj@gmail.com";

/** 개인정보처리방침 최종 개정일 (개정 시 함께 갱신). */
export const PRIVACY_UPDATED_AT = "2026-07-16";
