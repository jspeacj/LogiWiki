import "server-only";
import { getPublicClient } from "@/lib/supabase/read";

export type RankWindow = "week" | "month" | "year";
const WINDOW_DAYS: Record<RankWindow, number> = { week: 7, month: 30, year: 365 };

/** 랭킹 정렬 기준. DB 의 top_books(p_sort) 와 값이 일치해야 한다. */
export type RankSort = "score" | "views" | "recommends";

export interface RankedBook {
  book_id: string;
  slug: string;
  title: string;
  topic: string;
  language: string;
  window_views: number;
  recommend_count: number;
  score: number;
}


export function isRankWindow(v: unknown): v is RankWindow {
  return v === "week" || v === "month" || v === "year";
}

export function isRankSort(v: unknown): v is RankSort {
  return v === "score" || v === "views" || v === "recommends";
}

/** URL 쿼리(?sort=)를 안전한 값으로 정규화. 알 수 없는 값은 기본값. */
export function parseRankSort(v: unknown): RankSort {
  return isRankSort(v) ? v : "score";
}

/**
 * URL 쿼리(?topic=) 정규화 — 슬러그 형식만 검사한다.
 * 토픽은 이제 DB 가 원천이므로 코드에서 목록을 알 수 없다. 존재하지 않는 슬러그면
 * 랭킹 결과가 빈 목록으로 나온다(잘못된 값으로 SQL 을 때리지 않도록 형식만 막는다).
 */
export function parseRankTopic(v: unknown): string | undefined {
  return typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,38}$/.test(v)
    ? v
    : undefined;
}

export interface TopBooksParams {
  window: RankWindow;
  topic?: string;
  sort?: RankSort;
  limit?: number;
}

/** 랭킹(주/월/년 × 전체/토픽 × 종합/조회수/추천수): top_books RPC. */
export async function topBooks({
  window,
  topic,
  sort = "score",
  limit = 20,
}: TopBooksParams): Promise<RankedBook[]> {
  // top_books 는 security definer 공개 RPC 라 세션이 필요 없다 → 쿠키 없는 anon 클라이언트로
  // 읽어 불필요한 cookies() 의존(동적화)을 피한다.
  const supabase = getPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("top_books", {
    p_window_days: WINDOW_DAYS[window],
    p_topic: topic ?? null,
    p_limit: limit,
    p_sort: sort,
  });
  if (error) {
    console.error("[wiki/rankings] top_books 실패", {
      code: error.code,
      message: error.message,
    });
    return [];
  }
  if (!data) return [];
  return (data as RankedBook[]).map((r) => ({
    ...r,
    window_views: Number(r.window_views ?? 0),
    recommend_count: Number(r.recommend_count ?? 0),
    score: Number(r.score ?? 0),
  }));
}
