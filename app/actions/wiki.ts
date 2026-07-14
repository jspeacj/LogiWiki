"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { TOPIC_SLUGS } from "@/lib/wiki/topics";
import { BOOK_LANGUAGES } from "@/lib/wiki/types";

export type WikiActionState = {
  ok?: boolean;
  id?: string;
  slug?: string;
  error?: string;
};

function isRateLimited(error: { message?: string } | null): boolean {
  return !!error?.message?.includes("RATE_LIMITED");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "untitled"
  );
}

const BookSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  topic: z.enum(TOPIC_SLUGS as [string, ...string[]]),
  language: z.enum(BOOK_LANGUAGES as unknown as [string, ...string[]]).default("ko"),
});

/** 사람 저작 서적 생성. 비관리자는 source='human' 강제. */
export async function createBook(
  _prev: WikiActionState,
  formData: FormData,
): Promise<WikiActionState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };

  const parsed = BookSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    topic: formData.get("topic"),
    language: formData.get("language") ?? "ko",
  });
  if (!parsed.success) return { error: "VALIDATION" };

  const slug = `${slugify(parsed.data.title)}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await session.supabase
    .from("books")
    .insert({
      slug,
      title: parsed.data.title,
      description: parsed.data.description,
      topic: parsed.data.topic,
      language: parsed.data.language,
      author_id: session.user.id,
      source: "human",
      status: "draft",
    })
    .select("id, slug")
    .single();

  if (isRateLimited(error)) return { error: "RATE_LIMITED" };
  if (error || !data) return { error: "WRITE_FAILED" };

  revalidatePath("/");
  revalidatePath("/admin/books");
  return { ok: true, id: data.id, slug: data.slug };
}

const BookUpdateSchema = BookSchema.extend({ id: z.string().uuid() });

/** 서적 메타(제목·설명·토픽·언어) 수정. 저자/관리자만(RLS 강제). */
export async function updateBook(
  _prev: WikiActionState,
  formData: FormData,
): Promise<WikiActionState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };

  const parsed = BookUpdateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    topic: formData.get("topic"),
    language: formData.get("language") ?? "ko",
  });
  if (!parsed.success) return { error: "VALIDATION" };

  // slug/status/카운터는 여기서 건드리지 않는다(발행은 setBookStatus, 카운터는 DB 소유).
  const { data, error } = await session.supabase
    .from("books")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      topic: parsed.data.topic,
      language: parsed.data.language,
    })
    .eq("id", parsed.data.id)
    .select("slug")
    .maybeSingle();
  if (error || !data) return { error: "WRITE_FAILED" };

  revalidatePath(`/admin/books/${parsed.data.id}`);
  revalidatePath(`/book/${data.slug}`);
  revalidatePath("/");
  return { ok: true, id: parsed.data.id, slug: data.slug };
}

const ChapterSchema = z.object({
  bookId: z.string().uuid(),
  slug: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(200000).default(""),
  sortOrder: z.coerce.number().default(1000),
});

/** 챕터 생성/수정(upsert by book_id+slug). 저자/관리자만(RLS 강제). */
export async function upsertChapter(
  _prev: WikiActionState,
  formData: FormData,
): Promise<WikiActionState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };

  const parsed = ChapterSchema.safeParse({
    bookId: formData.get("bookId"),
    slug: formData.get("slug"),
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    sortOrder: formData.get("sortOrder") ?? 1000,
  });
  if (!parsed.success) return { error: "VALIDATION" };

  const { error } = await session.supabase.from("chapters").upsert(
    {
      book_id: parsed.data.bookId,
      slug: slugify(parsed.data.slug),
      title: parsed.data.title,
      body: parsed.data.body,
      sort_order: parsed.data.sortOrder,
    },
    { onConflict: "book_id,slug" },
  );
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath(`/admin/books/${parsed.data.bookId}`);
  const slug = String(formData.get("bookSlug") ?? "");
  if (slug) revalidatePath(`/book/${slug}`, "layout");
  return { ok: true, slug: slugify(parsed.data.slug) };
}

/** 챕터 삭제(저자/관리자). */
export async function deleteChapter(
  chapterId: string,
  bookId: string,
  bookSlug?: string,
): Promise<WikiActionState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };
  if (!z.string().uuid().safeParse(chapterId).success) return { error: "VALIDATION" };

  const { error } = await session.supabase
    .from("chapters")
    .delete()
    .eq("id", chapterId);
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath(`/admin/books/${bookId}`);
  if (bookSlug) revalidatePath(`/book/${bookSlug}`, "layout");
  return { ok: true };
}

/** 서적 상태 전이(draft→in_review→published→archived). RLS+트리거가 최종 강제. */
export async function setBookStatus(
  bookId: string,
  status: "draft" | "in_review" | "published" | "archived",
  slug?: string,
): Promise<WikiActionState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };

  const { error } = await session.supabase
    .from("books")
    .update({ status })
    .eq("id", bookId);
  // 발행 트리거(enforce_book_publish)가 거부하면 여기로 온다(AI 소스를 비관리자가 발행 등).
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath("/");
  if (slug) revalidatePath(`/book/${slug}`, "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/books");
  revalidatePath(`/admin/books/${bookId}`);
  return { ok: true };
}

/** 서적 삭제(저자/관리자). */
export async function deleteBook(bookId: string): Promise<WikiActionState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };
  if (!isAdminEmail(session.user.email)) {
    // 저자 본인 삭제는 RLS 로 걸러지지만, 관리자 화면 전용이므로 관리자만 허용.
    return { error: "FORBIDDEN" };
  }
  const { error } = await session.supabase.from("books").delete().eq("id", bookId);
  if (error) return { error: "WRITE_FAILED" };
  revalidatePath("/admin");
  return { ok: true };
}
