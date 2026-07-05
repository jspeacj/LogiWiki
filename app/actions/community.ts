"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, isAdminOnlyCategory } from "@/lib/community/types";
import { isAdminEmail } from "@/lib/auth/admin";

/** 폼 액션 반환 상태(useActionState). */
export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const PostSchema = z.object({
  category: z.enum(CATEGORIES),
  title: z.string().trim().min(1).max(150),
  content: z.string().trim().min(1).max(20000),
});

const CommentSchema = z.object({
  postId: z.string().uuid(),
  content: z.string().trim().min(1).max(5000),
});

const CommentEditSchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  content: z.string().trim().min(1).max(5000),
});

/** rate-limit 트리거(0003_community.sql)가 던진 예외인지 판별. */
function isRateLimited(error: { message?: string } | null): boolean {
  return !!error?.message?.includes("RATE_LIMITED");
}

/** 로그인 사용자 반환, 없으면 null. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

/** 게시글 작성 → 상세로 이동. */
export async function createPost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };

  const parsed = PostSchema.safeParse({
    category: formData.get("category"),
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: "VALIDATION" };

  // 공지 등 관리자 전용 카테고리는 관리자만(서버 1차 차단, RLS 가 최종 강제).
  if (isAdminOnlyCategory(parsed.data.category) && !isAdminEmail(session.user.email)) {
    return { error: "FORBIDDEN" };
  }

  const { data, error } = await session.supabase
    .from("posts")
    .insert({ ...parsed.data, author_id: session.user.id })
    .select("id")
    .single();

  if (isRateLimited(error)) return { error: "RATE_LIMITED" };
  if (error || !data) return { error: "WRITE_FAILED" };

  revalidatePath("/community");
  redirect(`/community/${data.id}`);
}

/** 게시글 수정(작성자 본인 또는 관리자, RLS 강제) → 상세로. */
export async function updatePost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "VALIDATION" };

  const parsed = PostSchema.safeParse({
    category: formData.get("category"),
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: "VALIDATION" };

  if (isAdminOnlyCategory(parsed.data.category) && !isAdminEmail(session.user.email)) {
    return { error: "FORBIDDEN" };
  }

  const { error } = await session.supabase
    .from("posts")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { error: "WRITE_FAILED" };

  revalidatePath("/community");
  revalidatePath(`/community/${id}`);
  redirect(`/community/${id}`);
}

/** 게시글 삭제(작성자 본인 또는 관리자, RLS 강제) → 목록으로. */
export async function deletePost(formData: FormData): Promise<void> {
  const session = await requireUser();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await session.supabase.from("posts").delete().eq("id", id);
  revalidatePath("/community");
  redirect("/community");
}

/** 댓글 작성 → 해당 상세 갱신. */
export async function createComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };

  const parsed = CommentSchema.safeParse({
    postId: formData.get("postId"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: "VALIDATION" };

  const { error } = await session.supabase.from("comments").insert({
    post_id: parsed.data.postId,
    content: parsed.data.content,
    author_id: session.user.id,
  });
  if (isRateLimited(error)) return { error: "RATE_LIMITED" };
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath(`/community/${parsed.data.postId}`);
  return { ok: true };
}

/** 댓글 수정(작성자 본인 또는 관리자). 수정 시 edited=true → "(수정됨)" 표기. */
export async function updateComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };

  const parsed = CommentEditSchema.safeParse({
    id: formData.get("id"),
    postId: formData.get("postId"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: "VALIDATION" };

  // 이미 삭제(툼스톤)된 댓글은 수정 불가.
  const { data: existing } = await session.supabase
    .from("comments")
    .select("deleted_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!existing || existing.deleted_at) return { error: "WRITE_FAILED" };

  const { error } = await session.supabase
    .from("comments")
    .update({ content: parsed.data.content, edited: true })
    .eq("id", parsed.data.id)
    .is("deleted_at", null);
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath(`/community/${parsed.data.postId}`);
  return { ok: true };
}

/**
 * 댓글 삭제(소프트 삭제 → 툼스톤 표기).
 * 본인 댓글 삭제는 'user', 관리자가 타인 댓글 삭제는 'admin' 로 표기.
 * 삭제된 댓글은 더 이상 수정·삭제 불가. (RLS: 본인 또는 관리자만 UPDATE)
 */
export async function deleteComment(formData: FormData): Promise<void> {
  const session = await requireUser();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  const postId = String(formData.get("postId") ?? "");
  if (!id) return;

  const { data: comment } = await session.supabase
    .from("comments")
    .select("author_id, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!comment || comment.deleted_at) return; // 없음 또는 이미 삭제됨.

  const kind = comment.author_id === session.user.id ? "user" : "admin";

  await session.supabase
    .from("comments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_kind: kind,
      content: "[deleted]",
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (postId) revalidatePath(`/community/${postId}`);
}
