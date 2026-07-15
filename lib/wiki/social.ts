import "server-only";
import { getReadClient } from "@/lib/supabase/read";
import { mapCommentRow, type RawCommentRow } from "@/lib/supabase/embed";
import type { CommentItem } from "@/lib/community/types";

/** 서적 댓글 아이템(구조는 커뮤니티 댓글과 동일). */
export type BookCommentItem = CommentItem;

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
  return (data as RawCommentRow[]).map(mapCommentRow);
}

/**
 * 현재 로그인 사용자의 이 서적에 대한 상호작용 상태(추천·즐겨찾기).
 * 비로그인/미설정이면 둘 다 false.
 *
 * 추천 여부와 즐겨찾기 여부를 각각 조회하면 세션 검증(getUser)이 두 번 왕복한다.
 * 서적 상세는 트래픽이 많은 표면이므로 user 를 한 번만 확인하고 두 멤버십을 병렬 조회한다.
 */
export async function getBookInteractionState(
  bookId: string,
): Promise<{ recommended: boolean; bookmarked: boolean }> {
  const none = { recommended: false, bookmarked: false };
  const supabase = await getReadClient();
  if (!supabase) return none;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return none;

  const [rec, bm] = await Promise.all([
    supabase
      .from("book_recommendations")
      .select("book_id")
      .eq("book_id", bookId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("book_bookmarks")
      .select("book_id")
      .eq("book_id", bookId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  return { recommended: !!rec.data, bookmarked: !!bm.data };
}
