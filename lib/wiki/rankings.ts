import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isTopic } from "@/lib/wiki/topics";

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

async function getClient(): Promise<SupabaseClient | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  return createClient();
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

/** URL 쿼리(?topic=)를 정규화. 'all'/미지정/알 수 없는 토픽 → undefined(전체). */
export function parseRankTopic(v: unknown): string | undefined {
  return typeof v === "string" && isTopic(v) ? v : undefined;
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
  const supabase = await getClient();
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
