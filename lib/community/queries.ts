import "server-only";
import { getPublicClient, getReadClient } from "@/lib/supabase/read";
import {
  DEFAULT_PAGE_SIZE,
  type Category,
  type CommentItem,
  type PostDetail,
  type PostListItem,
} from "./types";


/** PostgREST or 필터를 깨뜨리는 문자를 제거(공백 치환). */
function sanitize(q: string): string {
  return q.replace(/[,()%*\\]/g, " ").trim();
}

type ListParams = {
  category?: Category | "all";
  q?: string;
  page?: number;
  perPage?: number;
};

export type ListResult = {
  items: PostListItem[];
  total: number;
  page: number;
  totalPages: number;
};

const LIST_SELECT =
  "id, category, title, view_count, created_at, author:profiles(id, nickname, avatar_url), comments(count)";

/** 게시글 목록 + 카테고리 필터 + 제목/닉네임 검색 + 페이지네이션. */
export async function listPosts({
  category = "all",
  q = "",
  page = 1,
  perPage = DEFAULT_PAGE_SIZE,
}: ListParams): Promise<ListResult> {
  const size = Math.max(1, perPage);
  const safePage = Math.max(1, page);
  const supabase = await getReadClient();
  if (!supabase) return { items: [], total: 0, page: safePage, totalPages: 1 };

  const from = (safePage - 1) * size;
  const to = from + size - 1;

  let query = supabase
    .from("posts")
    .select(LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (category !== "all") {
    query = query.eq("category", category);
  }

  const term = sanitize(q);
  if (term) {
    // 제목 OR 작성자 닉네임. 닉네임 매칭 author_id 를 먼저 찾아 합집합으로 거른다.
    const { data: profs } = await supabase
      .from("profiles")
      .select("id")
      .ilike("nickname", `%${term}%`)
      .limit(100);
    const ids = (profs ?? []).map((p: { id: string }) => p.id);

    if (ids.length) {
      query = query.or(`title.ilike.%${term}%,author_id.in.(${ids.join(",")})`);
    } else {
      query = query.ilike("title", `%${term}%`);
    }
  }

  const { data, count, error } = await query;
  if (error) return { items: [], total: 0, page: safePage, totalPages: 1 };

  const items: PostListItem[] = (data ?? []).map((row: RawListRow) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    view_count: row.view_count,
    created_at: row.created_at,
    author: normalizeAuthor(row.author),
    comment_count: row.comments?.[0]?.count ?? 0,
  }));

  const total = count ?? 0;
  return {
    items,
    total,
    page: safePage,
    totalPages: Math.max(1, Math.ceil(total / size)),
  };
}

/** 단일 게시글(본문 포함). */
export async function getPost(id: string): Promise<PostDetail | null> {
  const supabase = await getReadClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, category, title, content, view_count, created_at, updated_at, author_id, author:profiles(id, nickname, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as RawDetailRow;
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    content: row.content,
    view_count: row.view_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author_id: row.author_id,
    author: normalizeAuthor(row.author),
  };
}

/** 게시글 댓글(오래된 순). */
export async function getComments(postId: string): Promise<CommentItem[]> {
  const supabase = await getReadClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, content, edited, deleted_at, deleted_kind, created_at, author_id, author:profiles(id, nickname, avatar_url)",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []).map((row: RawCommentRow) => ({
    id: row.id,
    content: row.content,
    edited: row.edited ?? false,
    deleted_at: row.deleted_at ?? null,
    deleted_kind: row.deleted_kind ?? null,
    created_at: row.created_at,
    author_id: row.author_id,
    author: normalizeAuthor(row.author),
  }));
}

/**
 * 조회수 +1 (RPC). 실패해도 페이지 렌더는 막지 않는다.
 *
 * ⚠️ 반드시 **쿠키 없는** 클라이언트로 호출한다. 이 함수는 after() 안에서 불리는데,
 * Next 16 은 Server Component 의 after() 콜백에서 cookies() 를 만지면 런타임 에러를
 * 던진다 → 예외가 조용히 삼켜져 posts.view_count 가 영영 0 이었다.
 * (서적 쪽에서 e1dae75 로 고친 것과 같은 버그. increment_post_views 는 security definer
 *  공개 RPC 라 세션이 필요 없다.)
 */
export async function incrementViews(id: string): Promise<void> {
  const supabase = getPublicClient();
  if (!supabase) return;
  const { error } = await supabase.rpc("increment_post_views", { p_id: id });
  if (error) console.error("[incrementViews]", error.message);
}

// ── 임베드 응답 정규화 ───────────────────────────────────────────────────────
type RawAuthor = { id: string; nickname: string; avatar_url: string | null };

function normalizeAuthor(a: RawAuthor | RawAuthor[] | null): RawAuthor | null {
  if (!a) return null;
  return Array.isArray(a) ? a[0] ?? null : a;
}

type RawListRow = {
  id: string;
  category: Category;
  title: string;
  view_count: number;
  created_at: string;
  author: RawAuthor | RawAuthor[] | null;
  comments: { count: number }[] | null;
};

type RawDetailRow = {
  id: string;
  category: Category;
  title: string;
  content: string;
  view_count: number;
  created_at: string;
  updated_at: string;
  author_id: string;
  author: RawAuthor | RawAuthor[] | null;
};

type RawCommentRow = {
  id: string;
  content: string;
  edited: boolean | null;
  deleted_at: string | null;
  deleted_kind: "user" | "admin" | null;
  created_at: string;
  author_id: string;
  author: RawAuthor | RawAuthor[] | null;
};
