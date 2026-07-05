import "server-only";

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

const BOOK_LIST_COLUMNS =
  "id, slug, language, title, description, topic, source, status, view_count, recommend_count, cover_url, published_at, created_at, updated_at, author:profiles(id, nickname, avatar_url)";

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
  if (error || !data) return [];
  return buildTree(data as Array<Omit<ChapterNode, "children">>);
}

/**
 * slug + language 로 서적 조회(+목차 트리). status 필터를 걸지 않고 RLS 에 위임한다
 * → 비회원엔 published 만, 저자/관리자엔 자기 draft 도 보인다(미리보기).
 */
export async function getBookBySlug(
  slug: string,
  language = "ko",
): Promise<BookDetail | null> {
  const supabase = await getClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("books")
    .select(BOOK_LIST_COLUMNS)
    .eq("slug", slug)
    .eq("language", language)
    .maybeSingle();
  if (error || !data) return null;
  const book = mapBook(data as Record<string, unknown>);
  const chapters = await getChapterTree(book.id);
  return { ...book, chapters };
}

/** 서적 내 단일 챕터(본문 포함). */
export async function getChapter(
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
  if (error || !data) return null;
  return data as ChapterDetail;
}

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
