import "server-only";
import { unstable_cache } from "next/cache";
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

/** 5분. 랭킹이 몇 분 늦게 반영되는 건 사용자가 알아챌 수 없다. */
const RANKINGS_TTL_SECONDS = 300;

/**
 * 랭킹(주/월/년 × 전체/토픽 × 종합/조회수/추천수): top_books RPC.
 *
 * 결과는 5분 캐시된다. top_books 는 book_view_daily 를 윈도(최대 365일)로 집계하는
 * 이 앱에서 가장 비싼 쿼리인데, /rankings 라우트는 searchParams 를 읽어 force-dynamic
 * 이라 **페이지뷰마다** 이 집계를 새로 돌리고 있었다.
 *
 * 라우트가 동적인 것과 데이터가 동적이어야 하는 건 별개다 — 여기 입력은 전부 URL 에서
 * 오고(세션·쿠키 무관, getPublicClient), 출력은 공개 데이터라 캐시 키에 인자만 넣으면
 * 사용자 간 공유가 안전하다.
 */
const topBooksCached = unstable_cache(
  async function fetchTopBooks(
    windowDays: number,
    topic: string | null,
    sort: RankSort,
    limit: number,
  ): Promise<RankedBook[] | null> {
    // top_books 는 security definer 공개 RPC 라 세션이 필요 없다 → 쿠키 없는 anon 클라이언트.
    const supabase = getPublicClient();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc("top_books", {
      p_window_days: windowDays,
      p_topic: topic,
      p_limit: limit,
      p_sort: sort,
    });
    if (error) {
      console.error("[wiki/rankings] top_books 실패", {
        code: error.code,
        message: error.message,
      });
      // 빈 랭킹을 5분간 굳히지 않는다(일시 장애가 "인기 서적 없음" 으로 고착되는 것 방지).
      return null;
    }
    if (!data) return null;
    return (data as RankedBook[]).map((r) => ({
      ...r,
      window_views: Number(r.window_views ?? 0),
      recommend_count: Number(r.recommend_count ?? 0),
      score: Number(r.score ?? 0),
    }));
  },
  ["wiki-top-books"],
  { revalidate: RANKINGS_TTL_SECONDS, tags: ["rankings"] },
);

export async function topBooks({
  window,
  topic,
  sort = "score",
  limit = 20,
}: TopBooksParams): Promise<RankedBook[]> {
  const rows = await topBooksCached(WINDOW_DAYS[window], topic ?? null, sort, limit);
  return rows ?? [];
}
