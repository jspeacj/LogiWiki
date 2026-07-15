"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RecommendState = {
  ok?: boolean;
  recommended?: boolean;
  count?: number;
  error?: string;
};

export type ActionState = {
  ok?: boolean;
  error?: string;
};

export type BookmarkState = {
  ok?: boolean;
  bookmarked?: boolean;
  error?: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

function isRateLimited(error: { message?: string } | null): boolean {
  return !!error?.message?.includes("RATE_LIMITED");
}

/**
 * 서적 추천 토글(1인 1서적 1회).
 * insert 시도 → 23505(중복)면 delete 로 토글 해제. books.recommend_count 는 트리거가 동기화.
 * RLS 로 발행된 서적만 추천 가능(비발행이면 insert 거부 → WRITE_FAILED).
 */
export async function toggleRecommend(
  bookId: string,
  slug?: string,
): Promise<RecommendState> {
  const parsed = z.string().uuid().safeParse(bookId);
  if (!parsed.success) return { error: "VALIDATION" };

  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };

  const { supabase, user } = session;
  let recommended = true;

  const { error: insErr } = await supabase
    .from("book_recommendations")
    .insert({ book_id: bookId, user_id: user.id });

  if (insErr) {
    if (insErr.code === "23505") {
      // 이미 추천함 → 토글 해제.
      await supabase
        .from("book_recommendations")
        .delete()
        .eq("book_id", bookId)
        .eq("user_id", user.id);
      recommended = false;
    } else {
      return { error: "WRITE_FAILED" };
    }
  }

  // 트리거가 같은 트랜잭션에서 카운터를 갱신했으므로 최신값을 읽는다.
  const { data } = await supabase
    .from("books")
    .select("recommend_count")
    .eq("id", bookId)
    .maybeSingle();

  if (slug) revalidatePath(`/book/${slug}`);
  return { ok: true, recommended, count: data?.recommend_count ?? 0 };
}

/**
 * 서적 즐겨찾기 토글(로그인 필수, 비공개).
 * insert 시도 → 23505(중복)면 delete 로 토글 해제. 추천과 달리 공개 카운터가 없다.
 * RLS 로 발행된 서적만 즐겨찾기 가능(비발행이면 insert 거부 → WRITE_FAILED).
 */
export async function toggleBookmark(
  bookId: string,
  slug?: string,
): Promise<BookmarkState> {
  const parsed = z.string().uuid().safeParse(bookId);
  if (!parsed.success) return { error: "VALIDATION" };

  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };

  const { supabase, user } = session;
  let bookmarked = true;

  const { error: insErr } = await supabase
    .from("book_bookmarks")
    .insert({ book_id: bookId, user_id: user.id });

  if (insErr) {
    if (insErr.code === "23505") {
      // 이미 즐겨찾기함 → 토글 해제.
      await supabase
        .from("book_bookmarks")
        .delete()
        .eq("book_id", bookId)
        .eq("user_id", user.id);
      bookmarked = false;
    } else {
      return { error: "WRITE_FAILED" };
    }
  }

  if (slug) revalidatePath(`/book/${slug}`);
  revalidatePath("/favorites");
  return { ok: true, bookmarked };
}

const CommentSchema = z.object({
  bookId: z.string().uuid(),
  slug: z.string().min(1),
  content: z.string().trim().min(1).max(5000),
});

const CommentEditSchema = z.object({
  id: z.string().uuid(),
  bookId: z.string().uuid(),
  slug: z.string().min(1),
  content: z.string().trim().min(1).max(5000),
});

/** 서적 댓글 작성(로그인 필수). */
export async function createBookComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };

  const parsed = CommentSchema.safeParse({
    bookId: formData.get("bookId"),
    slug: formData.get("slug"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: "VALIDATION" };

  const { error } = await session.supabase.from("book_comments").insert({
    book_id: parsed.data.bookId,
    content: parsed.data.content,
    author_id: session.user.id,
  });
  if (isRateLimited(error)) return { error: "RATE_LIMITED" };
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath(`/book/${parsed.data.slug}`);
  return { ok: true };
}

/** 서적 댓글 수정(작성자 또는 관리자). */
export async function updateBookComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };

  const parsed = CommentEditSchema.safeParse({
    id: formData.get("id"),
    bookId: formData.get("bookId"),
    slug: formData.get("slug"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: "VALIDATION" };

  const { data: existing } = await session.supabase
    .from("book_comments")
    .select("deleted_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!existing || existing.deleted_at) return { error: "WRITE_FAILED" };

  const { error } = await session.supabase
    .from("book_comments")
    .update({ content: parsed.data.content, edited: true })
    .eq("id", parsed.data.id)
    .is("deleted_at", null);
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath(`/book/${parsed.data.slug}`);
  return { ok: true };
}

/** 서적 댓글 소프트 삭제(툼스톤). */
export async function deleteBookComment(formData: FormData): Promise<void> {
  const session = await requireUser();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!id) return;

  const { data: comment } = await session.supabase
    .from("book_comments")
    .select("author_id, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!comment || comment.deleted_at) return;

  const kind = comment.author_id === session.user.id ? "user" : "admin";

  await session.supabase
    .from("book_comments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_kind: kind,
      content: "[deleted]",
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (slug) revalidatePath(`/book/${slug}`);
}
