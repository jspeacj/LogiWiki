import "server-only";
import { getPublicClient, getReadClient } from "@/lib/supabase/read";
import { createAdminClient, hasAdminEnv } from "@/lib/supabase/admin";
import { normalizeAuthor } from "@/lib/supabase/embed";
import { escapeLikeValue } from "@/lib/supabase/filter";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookDetail,
  BookListItem,
  BookSort,
  ChapterDetail,
  ChapterNode,
} from "./types";


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

/**
 * 저자 임베드는 반드시 FK 를 명시한다(`!books_author_id_fkey`).
 *
 * books↔profiles 경로가 둘이라(직접 FK인 books.author_id, 그리고 book_recommendations 를
 * 경유하는 다대다) 그냥 `author:profiles(...)` 로 쓰면 PostgREST 가 PGRST201(모호함)로
 * 쿼리를 **거부**한다. 그러면 목록/상세가 조용히 빈 결과가 되어 404 로 보인다.
 */
const BOOK_LIST_COLUMNS =
  "id, slug, language, title, description, topic, source, status, view_count, recommend_count, cover_url, published_at, created_at, updated_at, author:profiles!books_author_id_fkey(id, nickname, avatar_url), topic_ref:topics!books_topic_fkey(label)";

/** topics 임베드 → 라벨. 없으면 슬러그 그대로(폴백). */
function topicLabelFrom(embed: unknown, slug: string): string {
  const row = Array.isArray(embed) ? embed[0] : embed;
  if (row && typeof row === "object" && typeof (row as { label?: unknown }).label === "string") {
    return (row as { label: string }).label;
  }
  return slug;
}

function mapBook(row: Record<string, unknown>): BookListItem {
  const topic = row.topic as string;
  return {
    id: row.id as string,
    slug: row.slug as string,
    language: row.language as BookListItem["language"],
    title: row.title as string,
    description: (row.description as string) ?? "",
    topic,
    topic_label: topicLabelFrom(row.topic_ref, topic),
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
  // published 만 조회한다 → 세션이 필요 없다. 쿠키 클라이언트를 쓰면 cookies() 때문에
  // 라우트가 dynamic 으로 떨어져 홈/목록의 `export const revalidate` 가 무시된다.
  const supabase = getPublicClient();
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
  if (q && q.trim()) query = query.ilike("title", `%${escapeLikeValue(q.trim())}%`);

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

/**
 * 현재 로그인 사용자가 즐겨찾기한 **발행된** 서적 목록(최근 추가순).
 * 비로그인/미설정이면 빈 배열. RLS(book_bookmarks_select_own)로 본인 것만 읽힌다.
 *
 * 2단계 쿼리다. book_bookmarks → books 를 한 번에 임베드하지 않는 이유:
 * books↔profiles 경로가 둘이라(직접 FK + book_recommendations 경유) 중첩 임베드가
 * PGRST201(모호성)로 거부될 위험이 있다(BOOK_LIST_COLUMNS 주석 참고). 먼저 즐겨찾기한
 * book_id 를 최근순으로 뽑고, 검증된 books 조회를 `.in()` 으로 재사용한다.
 *
 * 호출부(/favorites)가 이미 세션을 확인했다면 그 client·userId 를 넘겨 getUser 왕복을
 * 한 번 아낀다(auth 인자). 없으면 자체적으로 세션을 확인한다.
 */
export async function listBookmarkedBooks(
  auth?: { supabase: SupabaseClient; userId: string },
): Promise<BookListItem[]> {
  let supabase: SupabaseClient | null;
  let userId: string;
  if (auth) {
    supabase = auth.supabase;
    userId = auth.userId;
  } else {
    supabase = await getReadClient();
    if (!supabase) return [];
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    userId = user.id;
  }

  // 1) 내 즐겨찾기 book_id (최근 추가순). RLS 로 본인 행만.
  const { data: marks, error: markErr } = await supabase
    .from("book_bookmarks")
    .select("book_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  logQueryError("listBookmarkedBooks:marks", markErr);
  if (markErr || !marks || marks.length === 0) return [];

  const order = new Map<string, number>();
  (marks as Array<{ book_id: string }>).forEach((m, i) => order.set(m.book_id, i));
  const ids = [...order.keys()];

  // 2) 발행된 서적만 상세 조회(발행 취소된 것 제외). 반환 순서는 즐겨찾기 순으로 복원.
  const { data, error } = await supabase
    .from("books")
    .select(BOOK_LIST_COLUMNS)
    .in("id", ids)
    .eq("status", "published");
  logQueryError("listBookmarkedBooks:books", error);
  if (error || !data) return [];

  return (data as Record<string, unknown>[])
    .map(mapBook)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
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

/**
 * slug 로 서적 조회(+목차 트리). 서적+챕터를 임베드로 한 번에 읽는다.
 *
 * - status 필터를 걸지 않고 RLS 에 위임한다 → 비회원엔 published 만, 저자/관리자엔
 *   자기 draft 도 보인다(미리보기).
 * - language 는 필터가 아니라 선호값이다. URL 은 `/book/{slug}` 뿐이므로 언어를 강제로
 *   'ko' 로 필터하면 en/ja 서적이 목록엔 뜨는데 열면 404 가 된다. slug 는 생성 시
 *   랜덤 접미사가 붙어 사실상 유일하지만, 같은 slug 의 번역본이 있으면 선호 언어를 고른다.
 * - React cache: generateMetadata 와 페이지 본문이 같은 요청에서 두 번 호출해도 쿼리는 1회.
 * - preview: false(기본)면 쿠키 없는 anon 클라이언트로 읽어 라우트가 ISR 로 캐시될 수 있게
 *   한다(RLS 로 published 만). true(draftMode)면 세션 클라이언트로 저자/관리자의 draft 도
 *   미리보기. cache 키에 preview 가 포함되므로 공개/미리보기 결과가 섞이지 않는다.
 */
export const getBookBySlug = cache(async function getBookBySlug(
  slug: string,
  language = "ko",
  preview = false,
): Promise<BookDetail | null> {
  const supabase = preview ? await getReadClient() : getPublicClient();
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

/** 서적 내 단일 챕터(본문 포함). preview 는 getBookBySlug 와 동일 규칙(쿠키-프리 vs 세션). */
export const getChapter = cache(async function getChapter(
  bookId: string,
  chapterSlug: string,
  preview = false,
): Promise<ChapterDetail | null> {
  const supabase = preview ? await getReadClient() : getPublicClient();
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

/**
 * sitemap 용: 발행 서적의 랜딩 + 챕터 경로(+lastmod). NOINDEX 면 sitemap.ts 가 애초에 호출 안 함.
 * 발행·검증된 것만 색인한다는 규칙의 렌더측 절반(DB측은 RLS).
 *
 * 발행 데이터만 읽으므로 세션이 필요 없다 → 쿠키 없는 anon 클라이언트로 읽어 sitemap 라우트가
 * dynamic 으로 떨어지지 않게 한다(cookies() 접근이 정적화를 막는 것을 회피).
 */
export async function getPublishedSitemapUrls(): Promise<
  Array<{ path: string; lastmod: string }>
> {
  const supabase = getPublicClient();
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

/**
 * 조회수 기록(RPC).
 *
 * ⚠️ 쿠키 기반 클라이언트(getReadClient)를 쓰지 않는다. 조회 기록은 요청 컨텍스트를
 * 벗어난 곳에서도 불릴 수 있는데, 그 시점에 `cookies()` 접근이 실패하면 예외가 조용히
 * 삼켜져 조회수가 영영 오르지 않는다(실제로 그렇게 깨져 있었다).
 *
 * 0015 부터 **service-role** 로 부른다. record_book_view 는 원래 anon 에게 열린 공개
 * RPC 였는데, 익명 키가 클라이언트 번들에 있으므로 누구나 PostgREST 로 직접 호출해
 * 랭킹을 조작할 수 있었다(0008/0009 가 막은 직접 UPDATE 의 우회로). 이제 RPC 는
 * service-role 전용이고, 뷰어 식별자는 **서버에서** 계산해 넘긴다 — 클라이언트가 해시를
 * 고를 수 있으면 값을 무작위로 바꿔가며 중복 제거를 우회하므로 둘은 한 쌍이다.
 *
 * service-role env 가 없으면(로컬) 조용히 no-op — 조회수는 앱 동작에 필수가 아니다.
 */
export async function recordBookView(bookId: string, viewerHash: string): Promise<void> {
  if (!hasAdminEnv()) return;
  const { error } = await createAdminClient().rpc("record_book_view", {
    p_book_id: bookId,
    p_viewer_hash: viewerHash,
  });
  logQueryError("recordBookView", error);
}
