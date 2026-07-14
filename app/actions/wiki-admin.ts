"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { topicExists } from "@/lib/wiki/topics-db";
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
  topic: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,38}$/),
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
  if (!(await topicExists(parsed.data.topic))) return { error: "VALIDATION" };

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

// ── 퀴즈 검수 ────────────────────────────────────────────────────────────────
// 자동 생성된 퀴즈도 서적과 같은 규칙을 따른다: draft 로 들어오고, 관리자가 승인해야 출제된다.

/** 퀴즈 승인 → published(출제 시작). */
export async function approveQuiz(quizId: string): Promise<AdminActionState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "FORBIDDEN" };
  if (!z.string().uuid().safeParse(quizId).success) return { error: "VALIDATION" };

  const { error } = await admin.supabase
    .from("quizzes")
    .update({ status: "published" })
    .eq("id", quizId);
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath("/admin");
  return { ok: true };
}

/** 퀴즈 반려 → 삭제(초안은 보관할 가치가 없다). */
export async function rejectQuiz(quizId: string): Promise<AdminActionState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "FORBIDDEN" };
  if (!z.string().uuid().safeParse(quizId).success) return { error: "VALIDATION" };

  const { error } = await admin.supabase.from("quizzes").delete().eq("id", quizId);
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath("/admin");
  return { ok: true };
}

// ── AI 자동 생성 설정(매일 cron 이 읽는다) ──────────────────────────────────
export interface AiSettings {
  enabled: boolean;
  daily_book_count: number;
  language: string;
}

const SettingsSchema = z.object({
  enabled: z.coerce.boolean(),
  // 0 = 자동 생성 안 함. 상한 5 는 DB check 제약과 일치시킨다(대규모 생성 억제).
  daily_book_count: z.coerce.number().int().min(0).max(DAILY_CAP),
  language: z.enum(BOOK_LANGUAGES as unknown as [string, ...string[]]).default("ko"),
});

/**
 * 자동 생성 설정 저장(관리자 전용).
 * ⚠️ enabled=true + daily_book_count>0 이면 **매일 유료 Claude API 를 호출한다.**
 * ANTHROPIC_API_KEY 가 없으면 cron 이 그대로 스킵하므로 비용은 발생하지 않는다.
 */
export async function updateAiSettings(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "FORBIDDEN" };

  const parsed = SettingsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    daily_book_count: formData.get("daily_book_count") ?? 0,
    language: formData.get("language") ?? "ko",
  });
  if (!parsed.success) return { error: "VALIDATION" };

  const { error } = await admin.supabase
    .from("ai_settings")
    .update({
      enabled: parsed.data.enabled,
      daily_book_count: parsed.data.daily_book_count,
      language: parsed.data.language,
      updated_by: admin.user.id,
    })
    .eq("id", true);
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath("/admin");
  return { ok: true };
}
