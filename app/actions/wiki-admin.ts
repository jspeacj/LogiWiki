"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { TOPIC_SLUGS } from "@/lib/wiki/topics";
import { BOOK_LANGUAGES } from "@/lib/wiki/types";
import { MODEL_DRAFT } from "@/lib/ai/claude";

export type AdminActionState = { ok?: boolean; error?: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return { supabase, user };
}

const DAILY_CAP = 5;

const GenSchema = z.object({
  topic: z.enum(TOPIC_SLUGS as [string, ...string[]]),
  subtopic: z.string().trim().min(1).max(200),
  language: z.enum(BOOK_LANGUAGES as unknown as [string, ...string[]]).default("ko"),
});

/** AI 서적 생성 job 을 큐에 넣는다(관리자 전용, 일일 캡). cron 이 drain 한다. */
export async function enqueueGeneration(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "FORBIDDEN" };

  const parsed = GenSchema.safeParse({
    topic: formData.get("topic"),
    subtopic: formData.get("subtopic"),
    language: formData.get("language") ?? "ko",
  });
  if (!parsed.success) return { error: "VALIDATION" };

  // 일일 캡(대규모 콘텐츠 남용 억제).
  const { data: todayCount } = await admin.supabase.rpc("ai_jobs_today");
  if (typeof todayCount === "number" && todayCount >= DAILY_CAP) {
    return { error: "DAILY_CAP" };
  }

  const { error } = await admin.supabase.from("ai_generation_jobs").insert({
    topic: parsed.data.topic,
    subtopic: parsed.data.subtopic,
    language: parsed.data.language,
    model: MODEL_DRAFT,
    requested_by: admin.user.id,
  });
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath("/admin");
  return { ok: true };
}

/** 초안 승인 → published(트리거가 published_at 설정, AI 소스 발행은 관리자만 통과). */
export async function approveBook(bookId: string, slug?: string): Promise<AdminActionState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "FORBIDDEN" };

  const { error } = await admin.supabase
    .from("books")
    .update({ status: "published" })
    .eq("id", bookId);
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath("/admin");
  revalidatePath("/");
  if (slug) revalidatePath(`/book/${slug}`);
  return { ok: true };
}

/** 초안 반려 → archived. */
export async function rejectBook(bookId: string): Promise<AdminActionState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "FORBIDDEN" };

  const { error } = await admin.supabase
    .from("books")
    .update({ status: "archived" })
    .eq("id", bookId);
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath("/admin");
  return { ok: true };
}
