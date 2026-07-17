import "server-only";
import { getPublicClient, getReadClient } from "@/lib/supabase/read";
import { createAdminClient, hasAdminEnv } from "@/lib/supabase/admin";
import { normalizeAuthor } from "@/lib/supabase/embed";
import { escapeLikeValue } from "@/lib/supabase/filter";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTopics } from "./topics-db";
import type { Topic } from "./topics";
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

/** 서적 목록 캐시 무효화 태그 — 발행 목록을 바꾸는 쪽에서 revalidateTag 로 쓴다. */
export const BOOKS_CACHE_TAG = "books";

/**
 * 60초. **홈의 `export const revalidate = 60` 과 반드시 맞춘다**(app/page.tsx).
 *
 * 랭킹·토픽(300초)을 따라 5분으로 잡으면 안 된다. 홈은 60초 ISR 이고 "조회수가 1분 늦게
 * 반영되는 대신" 이라고 계약을 명시해 뒀는데, 안쪽 데이터 캐시가 5분이면 홈이 60초마다
 * 재렌더돼도 최대 5분 묵은 카운터를 받는다 — 라우트는 갱신되는데 데이터가 안 갱신되니
 * 그 계약이 조용히 깨진다(캐시가 두 겹일 때 실제 신선도는 **더 긴 쪽**이 정한다).
 *
 * 발행·수정·삭제는 태그로 즉시 turn 되므로(아래) TTL 이 좌우하는 건 카운터 지연뿐이다.
 * 60초로도 페이지뷰마다 돌던 쿼리는 사라진다 — 조합당 분당 1회로 수렴한다.
 */
const BOOKS_TTL_SECONDS = 60;

/**
 * 실제 DB 읽기. 실패·env 미설정이면 **null**(호출부가 빈 결과로 degrade).
 * 캐시 여부와 무관한 순수 쿼리 — 캐시 경로/비캐시 경로가 이걸 공유한다.
 */
async function queryBooks(
  topic: string | null,
  q: string,
  sort: BookSort,
  page: number,
  perPage: number,
): Promise<ListBooksResult | null> {
  // published 만 조회한다 → 세션이 필요 없다. 쿠키 클라이언트를 쓰면 cookies() 때문에
  // 라우트가 dynamic 으로 떨어져 홈/목록의 `export const revalidate` 가 무시된다.
  const supabase = getPublicClient();
  if (!supabase) return null;

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("books")
    .select(BOOK_LIST_COLUMNS, { count: "exact" })
    .eq("status", "published")
    .order(SORT_COLUMN[sort], { ascending: false, nullsFirst: false })
    .range(from, to);

  if (topic) query = query.eq("topic", topic);
  if (q) query = query.ilike("title", `%${escapeLikeValue(q)}%`);

  const { data, error, count } = await query;
  logQueryError("listBooks", error);
  if (error || !data) return null;

  return {
    items: (data as Record<string, unknown>[]).map(mapBook),
    total: count ?? 0,
    page,
    perPage,
  };
}

/**
 * 발행 서적 목록(검색어 없는 경우) — 5분 캐시, 사용자 간 공유.
 *
 * listBooks 는 이 앱에서 가장 자주 도는 쿼리다(홈 ×2, /books, /topic). 그런데 /books·/topic
 * 은 force-dynamic 이라 **페이지뷰마다** books SELECT + `count:"exact"`(전체 카운트 = 인덱스로
 * 못 끝내는 스캔)를 새로 돌고 있었다. 입력은 전부 URL 에서 오고(세션·쿠키 무관, getPublicClient)
 * 출력은 published 공개 데이터라, 캐시 키에 인자만 넣으면 사용자 간 공유가 안전하다.
 *
 * ⚠️ 실패 시 **throw** 한다 — 빈 목록을 5분간 굳히지 않기 위해서다. unstable_cache 는 거부된
 * 프로미스를 캐시하지 않으므로, 일시 장애가 "서적 없음"으로 고착되지 않는다(호출부가 catch).
 * null 을 반환하면 그 null 이 캐시되어 정확히 그 사고가 난다.
 */
const listBooksCached = unstable_cache(
  async function fetchBooks(
    topic: string | null,
    sort: BookSort,
    page: number,
    perPage: number,
  ): Promise<ListBooksResult> {
    const result = await queryBooks(topic, "", sort, page, perPage);
    if (!result) throw new Error("listBooks: query failed (not cached)");
    return result;
  },
  ["wiki-list-books"],
  { revalidate: BOOKS_TTL_SECONDS, tags: [BOOKS_CACHE_TAG] },
);

/** 발행된 서적 목록(토픽 필터·제목 검색·정렬·페이지네이션). RLS 로도 published 만 노출됨. */
export async function listBooks(
  params: ListBooksParams = {},
): Promise<ListBooksResult> {
  const { topic, q, sort = "recent", page = 1, perPage = 24 } = params;
  const search = typeof q === "string" ? q.trim() : "";
  const empty: ListBooksResult = { items: [], total: 0, page, perPage };

  // 🚨 검색은 캐시하지 않는다. q 는 사용자가 치는 임의 문자열이라 캐시 키가 무한히 늘어난다
  // (한 번 쓰이고 5분간 남는 엔트리가 검색마다 하나씩). 캐시가 노리는 건 목록 브라우징이다.
  if (search) {
    return (await queryBooks(topic ?? null, search, sort, page, perPage)) ?? empty;
  }

  try {
    return await listBooksCached(topic ?? null, sort, page, perPage);
  } catch {
    // 쿼리 실패(로그는 queryBooks 가 남긴다) 또는 env 미설정 → 빈 목록으로 degrade.
    return empty;
  }
}

/**
 * 토픽의 발행 서적 수(행은 안 가져오고 count 만). 요청 단위 캐시 —
 * generateMetadata 와 페이지 본문이 각각 불러도 쿼리는 1회.
 *
 * 용도: 발행 서적이 0권인 토픽 페이지를 noindex 처리한다. 토픽 행은 AI 가 새 분야를
 * 다루면 생기는데 서적은 검수 후에야 발행되므로, "토픽은 있는데 보여줄 서적이 없는"
 * 상태가 정상적으로 존재한다. 그 페이지가 색인되면 빈 페이지가 색인되는 셈이다.
 */
export const countPublishedBooksByTopic = cache(async function countPublishedBooksByTopic(
  topic: string,
): Promise<number> {
  const supabase = getPublicClient();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .eq("topic", topic);
  logQueryError("countPublishedBooksByTopic", error);
  return error ? 0 : (count ?? 0);
});

/**
 * 토픽별 발행 서적 수(모든 토픽 한 번에). getQuizCountsByTopic 의 서적판이다.
 *
 * 왜 필요한가 — 토픽 그리드·칩은 DB 의 **모든** 토픽을 링크하는데, 서적은 하루 1권씩만
 * 검수 후 발행된다(daily-book.yml). 그래서 대부분의 타일이 "아직 발행된 서적이 없습니다" 로
 * 이어졌다 — 사용자에겐 헛클릭이고, AdSense 심사관에겐 "실질 콘텐츠 없음" 의 전형이다
 * (/quiz 와 /topic/[topic] 은 이미 같은 이유로 빈 것을 걸러 낸다). 이 카운트로 빈 토픽을
 * 걸러 낸다 → getTopicsWithBooks.
 *
 * 필터 기준은 listBooks(queryBooks)와 **같은 status='published'** 여야 한다 — 여기서 count>0
 * 이라고 노출한 토픽을 눌렀을 때 실제로 listBooks 가 서적을 내놓아야 헛클릭이 안 된다.
 * 발행을 바꾸는 쪽이 revalidateTag(BOOKS_CACHE_TAG)로 즉시 무효화한다.
 *
 * 실패 시 {} 를 돌려도(그리고 캐시돼도) 안전하다 — getTopicsWithBooks 가 빈 카운트면
 * 전체 토픽으로 폴백하므로 변경 전 동작과 같아진다.
 */
export const getBookCountsByTopic = unstable_cache(
  async function fetchBookCountsByTopic(): Promise<Record<string, number>> {
    const supabase = getPublicClient();
    if (!supabase) return {};
    const { data, error } = await supabase
      .from("books")
      .select("topic")
      .eq("status", "published");
    if (error || !data) {
      logQueryError("getBookCountsByTopic", error);
      return {};
    }
    const counts: Record<string, number> = {};
    for (const row of data as Array<{ topic: string }>) {
      counts[row.topic] = (counts[row.topic] ?? 0) + 1;
    }
    return counts;
  },
  ["wiki-book-counts"],
  { revalidate: BOOKS_TTL_SECONDS, tags: [BOOKS_CACHE_TAG] },
);

/**
 * 발행 서적이 1권 이상 있는 토픽만(그리드·칩의 진입점 목록). 없으면 **전체 토픽으로 폴백**.
 *
 * 🚨 폴백이 이 함수의 핵심이다. 발행 서적이 0권이면(초기 상태, 혹은 초안이 전부 반려된 경우)
 * 필터 결과가 비어 홈 그리드가 통째로 사라진다 → 히어로 + 빈 그리드 = "파킹된 사이트" 인상.
 * 그럴 땐 전체 토픽을 그대로 보여준다(변경 전 동작). 즉 이 필터는 **보여줄 서적이 실제로
 * 있을 때만** 좁히고, 그렇지 않으면 손해를 끼치지 않는다.
 */
export async function getTopicsWithBooks(): Promise<Topic[]> {
  const [topics, counts] = await Promise.all([getTopics(), getBookCountsByTopic()]);
  const filtered = topics.filter((t) => (counts[t.slug] ?? 0) > 0);
  return filtered.length > 0 ? filtered : topics;
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

export interface SitemapEntry {
  path: string;
  lastmod: string;
}

export interface SitemapData {
  /** 발행 서적의 랜딩 + 챕터 경로. */
  urls: SitemapEntry[];
  /** **발행 서적이 1권 이상 있는** 토픽만. lastmod = 그 토픽에서 가장 최근에 갱신된 서적. */
  topics: SitemapEntry[];
}

/**
 * sitemap 용 데이터. NOINDEX 면 sitemap.ts 가 애초에 호출 안 함.
 * 발행·검증된 것만 색인한다는 규칙의 렌더측 절반(DB측은 RLS).
 *
 * 발행 데이터만 읽으므로 세션이 필요 없다 → 쿠키 없는 anon 클라이언트로 읽어 sitemap 라우트가
 * dynamic 으로 떨어지지 않게 한다(cookies() 접근이 정적화를 막는 것을 회피).
 *
 * 토픽을 여기서 같이 뽑는 이유 — 예전엔 sitemap.ts 가 `getTopics()`(=topics 테이블 전체)로
 * 토픽 URL 을 만들었다. 그런데 서적은 항상 draft 로 들어와 사람이 승인해야 발행되므로,
 * **발행된 서적이 하나도 없는 토픽 행이 정상적으로 존재한다**(AI 가 새 토픽을 만든 직후,
 * 혹은 그 초안이 반려된 경우 영구히). 그런 URL 을 sitemap 에 넣으면 "아직 발행된 서적이
 * 없습니다" 만 있는 빈 페이지를 구글에 제출하는 꼴 — 심사에서 thin content 신호가 된다.
 * 발행 서적에서 토픽을 역산하면 빈 토픽이 구조적으로 들어올 수 없다.
 */
export async function getSitemapData(): Promise<SitemapData> {
  const supabase = getPublicClient();
  if (!supabase) return { urls: [], topics: [] };
  const { data, error } = await supabase
    .from("books")
    .select("slug, topic, updated_at, chapters(slug, updated_at)")
    .eq("status", "published")
    .not("published_at", "is", null);
  if (error || !data) {
    logQueryError("getSitemapData", error);
    return { urls: [], topics: [] };
  }

  const urls: SitemapEntry[] = [];
  const topicLastmod = new Map<string, string>();

  for (const row of data as Array<{
    slug: string;
    topic: string;
    updated_at: string;
    chapters: Array<{ slug: string; updated_at: string }> | null;
  }>) {
    urls.push({ path: `book/${row.slug}`, lastmod: row.updated_at });
    for (const ch of row.chapters ?? []) {
      urls.push({ path: `book/${row.slug}/${ch.slug}`, lastmod: ch.updated_at });
    }
    const prev = topicLastmod.get(row.topic);
    if (!prev || row.updated_at > prev) topicLastmod.set(row.topic, row.updated_at);
  }

  const topics: SitemapEntry[] = [...topicLastmod].map(([slug, lastmod]) => ({
    path: `topic/${slug}`,
    lastmod,
  }));

  return { urls, topics };
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
