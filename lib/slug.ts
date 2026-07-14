/**
 * URL 슬러그 생성 (서적·챕터 공용).
 *
 * ⚠️ **ASCII 만 허용한다.** 한글을 남기면 안 된다.
 * PostgREST 필터에 비ASCII 값을 넣으면 요청이 실패해(`Something went wrong`),
 * `.eq("slug", "한글-slug")` 조회가 통째로 죽고 페이지가 404 가 된다.
 * 실제로 AI 가 만든 한글 제목 서적이 이 문제로 열리지 않았다.
 *
 * 한글 제목이면 slug 로 남길 ASCII 가 없을 수 있으므로, 호출부가 fallback 을 넘긴다.
 */

/** 허용 문자: 영문 소문자·숫자·하이픈. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function slugify(input: string, fallback = "untitled"): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD") // 악센트 분리(é → e + ́)
    .replace(/[̀-ͯ]/g, "") // 결합 악센트 제거 → café = cafe
    .replace(/[^a-z0-9\s-]/g, " ") // 비ASCII·기호는 공백으로(단어 경계 보존)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, ""); // slice 로 잘리면서 끝에 하이픈이 남을 수 있다

  return slug || fallback;
}

/** 충돌 방지용 짧은 접미사(base36). */
export function shortSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
