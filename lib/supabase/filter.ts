/**
 * PostgREST 쿼리 입력 정제 (SSOT).
 *
 * ⚠️ 두 함수는 **맥락이 다르므로 바꿔 쓰면 안 된다.** 단일 .ilike 값과 .or() 필터 문자열은
 * 보안 요구가 다르다 — 전자는 이스케이프로 충분하지만, 후자는 or() 구문 문자를 제거해야
 * 필터 인젝션을 막을 수 있다.
 */

/**
 * 단일 `.ilike("col", `%${escapeLikeValue(v)}%`)` 값용.
 * LIKE 특수문자(%,_,\)를 이스케이프해 사용자 입력을 리터럴로 매칭한다.
 */
export function escapeLikeValue(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * `.or(`title.ilike.%${term}%,author_id.in.(...)`)` 처럼 term 이 or() 필터 **문자열**에
 * 들어갈 때용. PostgREST or() 구분자(,()) 와 패턴 문자(%*), 백슬래시를 제거(공백 치환)한다.
 * 이스케이프로는 or() 인젝션을 막을 수 없어 아예 제거한다.
 */
export function sanitizeOrTerm(q: string): string {
  return q.replace(/[,()%*\\]/g, " ").trim();
}
