import "server-only";
import { getReadClient } from "@/lib/supabase/read";
import type { CommentItem } from "@/lib/community/types";

/** 서적 댓글 아이템(구조는 커뮤니티 댓글과 동일). */
export type BookCommentItem = CommentItem;


type RawAuthor = { id: string; nickname: string; avatar_url: string | null };
function normalizeAuthor(a: RawAuthor | RawAuthor[] | null): RawAuthor | null {
  if (!a) return null;
  return Array.isArray(a) ? a[0] ?? null : a;
}

/** 서적 댓글(오래된 순). 비회원도 열람 가능. */
export async function getBookComments(bookId: string): Promise<BookCommentItem[]> {
  const supabase = await getReadClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("book_comments")
    .select(
      "id, content, edited, deleted_at, deleted_kind, created_at, author_id, author:profiles(id, nickname, avatar_url)",
    )
    .eq("book_id", bookId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (
    data as Array<{
      id: string;
      content: string;
      edited: boolean | null;
      deleted_at: string | null;
      deleted_kind: "user" | "admin" | null;
      created_at: string;
      author_id: string;
      author: RawAuthor | RawAuthor[] | null;
    }>
  ).map((row) => ({
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

/** 현재 로그인 사용자가 이 서적을 추천했는지. 비로그인/미설정이면 false. */
export async function hasRecommended(bookId: string): Promise<boolean> {
  const supabase = await getReadClient();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("book_recommendations")
    .select("book_id")
    .eq("book_id", bookId)
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data;
}
