import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRef } from "@/lib/auth/types";
import type {
  BookDetail,
  BookListItem,
  BookSort,
  ChapterDetail,
  ChapterNode,
} from "./types";

/** env 미설정(로컬 Supabase 없음) 시 null → 호출부는 빈 결과로 degrade. */
async function getClient(): Promise<SupabaseClient | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  return createClient();
}

/**
 * 쿼리 실패를 서버 로그에 남긴다.
 *
 * 이 모듈은 에러를 빈 결과로 degrade 시키는데(env 미설정 시 앱이 뜨도록), 그 탓에 진짜 쿼리
 * 오류까지 조용히 삼켜져 "데이터가 없음"과 구분되지 않는다. 실제로 PGRST201(임베드 모호성)이
 * 이 경로로 숨어 서적 목록·상세가 통째로 404 로 보인 적이 있다. 이제는 로그로 드러난다.
 */
function logQueryError(where: string, error: { message?: string; code?: string } | null): void {
  if (!error) return;
  console.error(`[wiki/queries] ${where} 실패`, {
    code: error.code,
    message: error.message,
  });
}

/** PostgREST 임베드(object|array) → 단일 ProfileRef 로 정규화. */
function normalizeAuthor(embed: unknown): ProfileRef | null {
  if (!embed) return null;
  const row = Array.isArray(embed) ? embed[0] : embed;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.nickname !== "string") return null;
  return {
    id: r.id,
    nickname: r.nickname,
    avatar_url: (r.avatar_url as string | null) ?? null,
  };
}

/**
 * 저자 임베드는 반드시 FK 를 명시한다(`!books_author_id_fkey`).
 *
 * books↔profiles 경로가 둘이라(직접 FK인 books.author_id, 그리고 book_recommendations 를
 * 경유하는 다대다) 그냥 `author:profiles(...)` 로 쓰면 PostgREST 가 PGRST201(모호함)로
 * 쿼리를 **거부**한다. 그러면 목록/상세가 조용히 빈 결과가 되어 404 로 보인다.
 */
const BOOK_LIST_COLUMNS =
  "id, slug, language, title, description, topic, source, status, view_count, recommend_count, cover_url, published_at, created_at, updated_at, author:profiles!books_author_id_fkey(id, nickname, avatar_url)";

/** ilike 패턴 특수문자 이스케이프(%, _, \). */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function mapBook(row: Record<string, unknown>): BookListItem {
  return {
    id: row.id as string,
    slug: row.slug as string,
    language: row.language as BookListItem["language"],
    title: row.title as string,
    description: (row.description as string) ?? "",
    topic: row.topic as string,
    source: row.source as BookListItem["source"],
    status: row.status as BookListItem["status"],
    view_count: (row.view_count as number) ?? 0,
    recommend_count: (row.recommend_count as number) ?? 0,
    cover_url: (row.cover_url as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    author: normalizeAuthor(row.author),
  };
}

const SORT_COLUMN: Record<BookSort, string> = {
  recent: "published_at",
  popular: "view_count",
  recommended: "recommend_count",
};

export interface ListBooksParams {
  topic?: string;
  q?: string;
  sort?: BookSort;
  page?: number;
  perPage?: number;
}

export interface ListBooksResult {
  items: BookListItem[];
  total: number;
  page: number;
  perPage: number;
}

/** 발행된 서적 목록(토픽 필터·제목 검색·정렬·페이지네이션). RLS 로도 published 만 노출됨. */
export async function listBooks(
  params: ListBooksParams = {},
): Promise<ListBooksResult> {
  const { topic, q, sort = "recent", page = 1, perPage = 24 } = params;
  const supabase = await getClient();
  if (!supabase) return { items: [], total: 0, page, perPage };

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("books")
    .select(BOOK_LIST_COLUMNS, { count: "exact" })
    .eq("status", "published")
    .order(SORT_COLUMN[sort], { ascending: false, nullsFirst: false })
    .range(from, to);

  if (topic) query = query.eq("topic", topic);
  if (q && q.trim()) query = query.ilike("title", `%${escapeLike(q.trim())}%`);

  const { data, error, count } = await query;
  logQueryError("listBooks", error);
  if (error || !data) return { items: [], total: 0, page, perPage };

  return {
    items: (data as Record<string, unknown>[]).map(mapBook),
    total: count ?? 0,
    page,
    perPage,
  };
}

/** flat 챕터 배열 → parent_id/sort_order 로 메모리 트리 조립. */
function buildTree(
  rows: Array<Omit<ChapterNode, "children">>,
): ChapterNode[] {
  const byId = new Map<string, ChapterNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: ChapterNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (list: ChapterNode[]) => {
    list.sort((a, b) => a.sort_order - b.sort_order);
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/** 서적의 목차 트리(본문 제외). */
export async function getChapterTree(bookId: string): Promise<ChapterNode[]> {
  const supabase = await getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("chapters")
    .select("id, book_id, parent_id, slug, title, sort_order")
    .eq("book_id", bookId)
    .order("sort_order", { ascending: true });
  logQueryError("getChapterTree", error);
  if (error || !data) return [];
  return buildTree(data as Array<Omit<ChapterNode, "children">>);
}

/**
 * slug 로 서적 조회(+목차 트리). 서적+챕터를 임베드로 한 번에 읽는다.
 *
 * - status 필터를 걸지 않고 RLS 에 위임한다 → 비회원엔 published 만, 저자/관리자엔
 *   자기 draft 도 보인다(미리보기).
 * - language 는 필터가 아니라 선호값이다. URL 은 `/book/{slug}` 뿐이므로 언어를 강제로
 *   'ko' 로 필터하면 en/ja 서적이 목록엔 뜨는데 열면 404 가 된다. slug 는 생성 시
 *   랜덤 접미사가 붙어 사실상 유일하지만, 같은 slug 의 번역본이 있으면 선호 언어를 고른다.
 * - React cache: generateMetadata 와 페이지 본문이 같은 요청에서 두 번 호출해도 쿼리는 1회.
 */
export const getBookBySlug = cache(async function getBookBySlug(
  slug: string,
  language = "ko",
): Promise<BookDetail | null> {
  const supabase = await getClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("books")
    .select(
      `${BOOK_LIST_COLUMNS}, chapters(id, book_id, parent_id, slug, title, sort_order)`,
    )
    .eq("slug", slug);
  logQueryError("getBookBySlug", error);
  if (error || !data || data.length === 0) return null;

  const rows = data as Record<string, unknown>[];
  const row = rows.find((r) => r.language === language) ?? rows[0];
  const book = mapBook(row);
  const chapters = buildTree(
    (row.chapters ?? []) as Array<Omit<ChapterNode, "children">>,
  );
  return { ...book, chapters };
});

/** 서적 내 단일 챕터(본문 포함). */
export const getChapter = cache(async function getChapter(
  bookId: string,
  chapterSlug: string,
): Promise<ChapterDetail | null> {
  const supabase = await getClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("chapters")
    .select("id, book_id, parent_id, slug, title, body, sort_order, created_at, updated_at")
    .eq("book_id", bookId)
    .eq("slug", chapterSlug)
    .maybeSingle();
  logQueryError("getChapter", error);
  if (error || !data) return null;
  return data as ChapterDetail;
});

/** sitemap·generateStaticParams 용: 발행된 서적의 (slug, language). */
export async function getPublishedBookSlugs(): Promise<
  Array<{ slug: string; language: string; updated_at: string }>
> {
  const supabase = await getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("books")
    .select("slug, language, updated_at")
    .eq("status", "published")
    .not("published_at", "is", null);
  if (error || !data) return [];
  return data as Array<{ slug: string; language: string; updated_at: string }>;
}

/**
 * sitemap 용: 발행 서적의 랜딩 + 챕터 경로(+lastmod). NOINDEX 면 sitemap.ts 가 애초에 호출 안 함.
 * 발행·검증된 것만 색인한다는 규칙의 렌더측 절반(DB측은 RLS).
 */
export async function getPublishedSitemapUrls(): Promise<
  Array<{ path: string; lastmod: string }>
> {
  const supabase = await getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("books")
    .select("slug, updated_at, chapters(slug, updated_at)")
    .eq("status", "published")
    .not("published_at", "is", null);
  if (error || !data) return [];

  const urls: Array<{ path: string; lastmod: string }> = [];
  for (const row of data as Array<{
    slug: string;
    updated_at: string;
    chapters: Array<{ slug: string; updated_at: string }> | null;
  }>) {
    urls.push({ path: `book/${row.slug}`, lastmod: row.updated_at });
    for (const ch of row.chapters ?? []) {
      urls.push({ path: `book/${row.slug}/${ch.slug}`, lastmod: ch.updated_at });
    }
  }
  return urls;
}

/** 조회수 기록(RPC). 렌더 경로 밖에서 after() 로 fire-and-forget 호출. */
export async function recordBookView(bookId: string): Promise<void> {
  const supabase = await getClient();
  if (!supabase) return;
  await supabase.rpc("record_book_view", { p_book_id: bookId });
}
