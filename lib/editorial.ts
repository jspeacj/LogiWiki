/**
 * 편집자·연락처 SSOT.
 *
 * 소개/개인정보처리방침/문의 페이지와 서적 저자 표기가 모두 여기를 참조한다.
 * 값을 바꾸려면 이 파일만 고치면 된다.
 *
 * ⚠️ EDITOR_NAME 은 DB `profiles.nickname` 과 별개다. 서적 카드·상세의 저자 표기는
 *    DB 의 닉네임을 그대로 쓰므로, Supabase 에서 관리자 프로필의 nickname 도
 *    같은 값으로 바꿔야 화면이 일치한다(현재 "LogiWikiAdmin").
 */

/** 서적 편집·감수자 표기명. 실명 — 검색·AdSense 의 E-E-A-T 신호가 가장 강하다. */
export const EDITOR_NAME = "김보성";

/** 문의·개인정보 관련 연락처. */
export const CONTACT_EMAIL = "jspeacj@gmail.com";

/** 개인정보처리방침 최종 개정일 (개정 시 함께 갱신). */
export const PRIVACY_UPDATED_AT = "2026-07-16";
