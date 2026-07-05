import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type RankWindow = "week" | "month" | "year";
const WINDOW_DAYS: Record<RankWindow, number> = { week: 7, month: 30, year: 365 };

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

/** 랭킹(주/월/년): top_books RPC. */
export async function topBooks(
  window: RankWindow,
  topic?: string,
  limit = 20,
): Promise<RankedBook[]> {
  const supabase = await getClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("top_books", {
    p_window_days: WINDOW_DAYS[window],
    p_topic: topic ?? null,
    p_limit: limit,
  });
  if (error || !data) return [];
  return (data as RankedBook[]).map((r) => ({
    ...r,
    window_views: Number(r.window_views ?? 0),
    recommend_count: Number(r.recommend_count ?? 0),
    score: Number(r.score ?? 0),
  }));
}
