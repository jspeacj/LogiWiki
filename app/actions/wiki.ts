"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin, isRateLimited, type ActionState } from "@/lib/auth/actions";
import { topicExists } from "@/lib/wiki/topics-db";
import { shortSuffix, slugify } from "@/lib/slug";
import { BOOK_LANGUAGES } from "@/lib/wiki/types";

/**
 * 서적 계열 쓰기는 전부 관리자 전용이다.
 *
 * 서버 액션은 UI 가 아니라 **공개 HTTP 엔드포인트**다 — 관리자 UI 를 숨긴 것만으로는 못 막는다.
 * 예전엔 로그인만 확인해 아무나 createBook → upsertChapter → setBookStatus('published') 로
 * 홈·목록·sitemap 에 즉시 게시할 수 있었다. 이제 모든 mutation 이 requireAdmin(lib/auth/actions)
 * 을 통과하고, DB 도 0013 에서 "published 전이는 언제나 is_admin()" 으로 좁혔다(2중 방어).
 */
export type WikiActionState = ActionState & { id?: string; slug?: string };

const BookSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  topic: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,38}$/),
  language: z.enum(BOOK_LANGUAGES as unknown as [string, ...string[]]).default("ko"),
});

/** 사람 저작 서적 생성. 비관리자는 source='human' 강제. */
export async function createBook(
  _prev: WikiActionState,
  formData: FormData,
): Promise<WikiActionState> {
  const session = await requireAdmin();
  if (!session) return { error: "FORBIDDEN" };

  const parsed = BookSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    topic: formData.get("topic"),
    language: formData.get("language") ?? "ko",
  });
  if (!parsed.success) return { error: "VALIDATION" };
  // 토픽은 DB(public.topics)가 원천. FK 가 최종 방어선이지만 여기서 명확한 에러를 준다.
  if (!(await topicExists(parsed.data.topic))) return { error: "VALIDATION" };

  // 제목이 한글이면 남는 ASCII 가 없을 수 있다 → 토픽을 fallback 으로 쓴다.
  const slug = `${slugify(parsed.data.title, parsed.data.topic)}-${shortSuffix()}`;
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
  const session = await requireAdmin();
  if (!session) return { error: "FORBIDDEN" };

  const parsed = BookUpdateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    topic: formData.get("topic"),
    language: formData.get("language") ?? "ko",
  });
  if (!parsed.success) return { error: "VALIDATION" };
  if (!(await topicExists(parsed.data.topic))) return { error: "VALIDATION" };

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
  const session = await requireAdmin();
  if (!session) return { error: "FORBIDDEN" };

  const parsed = ChapterSchema.safeParse({
    bookId: formData.get("bookId"),
    slug: formData.get("slug"),
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    sortOrder: formData.get("sortOrder") ?? 1000,
  });
  if (!parsed.success) return { error: "VALIDATION" };

  // 챕터 slug 도 ASCII 만 — 한글이면 chapter-{순서} 로 폴백한다.
  const chapterSlug = slugify(
    parsed.data.slug,
    `chapter-${Math.round(parsed.data.sortOrder / 1000) || 1}`,
  );

  const { error } = await session.supabase.from("chapters").upsert(
    {
      book_id: parsed.data.bookId,
      slug: chapterSlug,
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
  return { ok: true, slug: chapterSlug };
}

/** 챕터 삭제(저자/관리자). */
export async function deleteChapter(
  chapterId: string,
  bookId: string,
  bookSlug?: string,
): Promise<WikiActionState> {
  const session = await requireAdmin();
  if (!session) return { error: "FORBIDDEN" };
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

// 서버 액션 인자는 TS 타입이 아니라 네트워크 입력이다 — 런타임에서 좁힌다.
const StatusSchema = z.object({
  bookId: z.string().uuid(),
  status: z.enum(["draft", "in_review", "published", "archived"]),
});

/** 서적 상태 전이(draft→in_review→published→archived). 관리자 전용 + 트리거가 최종 강제. */
export async function setBookStatus(
  bookId: string,
  status: "draft" | "in_review" | "published" | "archived",
  slug?: string,
): Promise<WikiActionState> {
  const session = await requireAdmin();
  if (!session) return { error: "FORBIDDEN" };

  const parsed = StatusSchema.safeParse({ bookId, status });
  if (!parsed.success) return { error: "VALIDATION" };

  const { error } = await session.supabase
    .from("books")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.bookId);
  // 발행 트리거(enforce_book_publish)가 거부하면 여기로 온다(비관리자의 published 전이).
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath("/");
  if (slug) revalidatePath(`/book/${slug}`, "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/books");
  revalidatePath(`/admin/books/${bookId}`);
  return { ok: true };
}

/** 서적 삭제(관리자 전용). */
export async function deleteBook(bookId: string): Promise<WikiActionState> {
  const session = await requireAdmin();
  if (!session) return { error: "FORBIDDEN" };
  if (!z.string().uuid().safeParse(bookId).success) return { error: "VALIDATION" };

  const { error } = await session.supabase.from("books").delete().eq("id", bookId);
  if (error) return { error: "WRITE_FAILED" };
  revalidatePath("/admin");
  return { ok: true };
}
