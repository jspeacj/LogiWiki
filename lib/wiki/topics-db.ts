import "server-only";

import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { TOPICS as BUILTIN_TOPICS, type Topic } from "./topics";

/**
 * 토픽 SSOT — 런타임 원천은 DB(public.topics).
 *
 * 코드의 TOPICS(lib/wiki/topics.ts)는 0011 마이그레이션의 시드이자 **폴백**이다.
 * AI 자동 생성이 기존에 없던 분야를 다루면 토픽 행을 새로 만들기 때문에, 앱은 코드 상수가
 * 아니라 DB 를 읽어야 한다. DB 를 못 읽으면(로컬 env 미설정 등) 내장 14개로 우아하게 degrade.
 *
 * 읽기 전용·공개 데이터이므로 쿠키 없는 anon 클라이언트를 쓴다(요청당 1회, React cache).
 */

export type { Topic };

const TABLE_COLUMNS = "slug, label, description, accent, sort_order, source";

type Row = {
  slug: string;
  label: string;
  description: string;
  accent: string;
  sort_order: number;
  source: string;
};

/** 요청 단위 캐시 — 한 페이지에서 여러 번 불러도 쿼리는 1회. */
export const getTopics = cache(async function getTopics(): Promise<Topic[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return BUILTIN_TOPICS;

  const supabase = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("topics")
    .select(TABLE_COLUMNS)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) {
    if (error) {
      console.error("[wiki/topics-db] getTopics 실패 — 내장 토픽으로 폴백", {
        code: error.code,
        message: error.message,
      });
    }
    return BUILTIN_TOPICS;
  }

  return (data as Row[]).map((r) => ({
    slug: r.slug,
    label: r.label,
    desc: r.description,
    accent: r.accent,
  }));
});

export const getTopicMap = cache(async function getTopicMap(): Promise<
  Record<string, Topic>
> {
  const topics = await getTopics();
  return Object.fromEntries(topics.map((t) => [t.slug, t]));
});

export async function getTopicBySlug(slug: string): Promise<Topic | undefined> {
  return (await getTopicMap())[slug];
}

/** 존재하는 토픽인지(서버 액션 검증용). */
export async function topicExists(slug: unknown): Promise<boolean> {
  if (typeof slug !== "string") return false;
  return slug in (await getTopicMap());
}

/** 슬러그 → 라벨. 알 수 없으면 슬러그 그대로(폴백). */
export async function topicLabelOf(slug: string): Promise<string> {
  return (await getTopicMap())[slug]?.label ?? slug;
}
