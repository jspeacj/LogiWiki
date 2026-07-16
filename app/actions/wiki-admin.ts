"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin, type ActionState } from "@/lib/auth/actions";
import { topicExists } from "@/lib/wiki/topics-db";
import { BOOK_LANGUAGES } from "@/lib/wiki/types";
import { MODEL_DRAFT } from "@/lib/ai/claude";

export type AdminActionState = ActionState;

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

// ── 일괄 검수 ────────────────────────────────────────────────────────────────
//
// 일괄 액션이 **원형**이고 단일 액션은 여기에 위임한다(SSOT — 검수 경로가 둘로 갈라지면
// 한쪽에만 가드가 붙는 사고가 난다).
//
// 🚨 서적에는 일괄 **발행**이 없다. 의도적이다.
//    검수 목록은 제목·토픽만 렌더하고 본문은 미리보기/편집기로 들어가야 보인다. 즉 목록에서
//    일괄 발행을 허용하면 **구조적으로 안 읽고 발행**하는 버튼이 된다 — AGENTS.md 가 최대
//    리스크로 규정한 "사람 검수 없는 대량 AI 발행"(scaled content abuse) 그 자체다.
//    게다가 서적은 하루 1권이라 큐가 보통 1~3권이고, 일괄로 절약되는 클릭이 거의 없다.
//    반면 **반려**는 아무것도 공개하지 않으므로 일괄로 열어도 안전하다.
//    퀴즈는 반대다 — 목록이 문제·선택지·정답·해설을 전부 펼쳐 보여주므로(quiz-review.tsx)
//    훑고 일괄 승인하는 게 실제 검수가 된다. 그래서 퀴즈만 일괄 승인이 있다.

export type BulkActionState = AdminActionState & { count?: number };

/** 한 번에 처리할 상한. 퀴즈 큐 상한(30)보다 여유를 둔다. */
const BULK_MAX = 50;

const IdsSchema = z.array(z.string().uuid()).min(1).max(BULK_MAX);

/**
 * 초안 일괄 반려 → archived.
 *
 * 상태를 draft/in_review 로 좁혀서 UPDATE 한다. 목록은 클라이언트에 있고 다른 탭·cron 이
 * 그 사이 상태를 바꿨을 수 있으므로(stale), id 만 믿으면 **이미 발행된 서적을 내려버릴** 수
 * 있다. count 로 실제 반영 건수를 돌려주니 UI 가 "3권 중 2권" 같은 차이도 드러낼 수 있다.
 */
export async function rejectBooks(bookIds: string[]): Promise<BulkActionState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "FORBIDDEN" };

  const parsed = IdsSchema.safeParse(bookIds);
  if (!parsed.success) return { error: "VALIDATION" };

  const { error, count } = await admin.supabase
    .from("books")
    .update({ status: "archived" }, { count: "exact" })
    .in("id", parsed.data)
    .in("status", ["draft", "in_review"]);
  if (error) return { error: "WRITE_FAILED" };

  revalidatePath("/admin");
  return { ok: true, count: count ?? 0 };
}

/** 초안 반려 → archived. */
export async function rejectBook(bookId: string): Promise<AdminActionState> {
  return rejectBooks([bookId]);
}

// ── 퀴즈 검수 ────────────────────────────────────────────────────────────────
// 자동 생성된 퀴즈도 서적과 같은 규칙을 따른다: draft 로 들어오고, 관리자가 승인해야 출제된다.

/**
 * 출제 목록에 영향을 주는 변경 후 캐시 무효화.
 *
 * /quiz 는 문항이 있는 토픽만 노출하는데, 그 카운트는 5분 TTL 로 캐시된다
 * (lib/wiki/quizzes.ts::getQuizCountsByTopic, tag="quizzes"). 무효화하지 않으면 승인
 * 직후에도 최대 5분간 그 토픽이 목록에 안 뜬다. 페이지 자체도 ISR(300s)이라 함께 턴다.
 */
function revalidateQuizSurfaces(): void {
  revalidateTag("quizzes", "max");
  revalidatePath("/quiz");
  revalidatePath("/admin");
}

/**
 * 퀴즈 일괄 승인 → published(출제 시작).
 *
 * 목록이 정답·해설까지 전부 펼쳐 보여주므로(quiz-review.tsx) 훑고 일괄 승인하는 게
 * 실제 검수가 된다. 서적에 일괄 발행이 없는 이유는 위 "일괄 검수" 블록 주석 참고.
 *
 * status=draft 로 좁히는 이유는 rejectBooks 와 같다(stale 목록 방어).
 */
export async function approveQuizzes(quizIds: string[]): Promise<BulkActionState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "FORBIDDEN" };

  const parsed = IdsSchema.safeParse(quizIds);
  if (!parsed.success) return { error: "VALIDATION" };

  const { error, count } = await admin.supabase
    .from("quizzes")
    .update({ status: "published" }, { count: "exact" })
    .in("id", parsed.data)
    .eq("status", "draft");
  if (error) return { error: "WRITE_FAILED" };

  revalidateQuizSurfaces();
  return { ok: true, count: count ?? 0 };
}

/** 퀴즈 일괄 반려 → 삭제(초안은 보관할 가치가 없다). 발행본은 건드리지 않는다. */
export async function rejectQuizzes(quizIds: string[]): Promise<BulkActionState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "FORBIDDEN" };

  const parsed = IdsSchema.safeParse(quizIds);
  if (!parsed.success) return { error: "VALIDATION" };

  const { error, count } = await admin.supabase
    .from("quizzes")
    .delete({ count: "exact" })
    .in("id", parsed.data)
    .eq("status", "draft");
  if (error) return { error: "WRITE_FAILED" };

  revalidateQuizSurfaces();
  return { ok: true, count: count ?? 0 };
}

/** 퀴즈 승인 → published(출제 시작). */
export async function approveQuiz(quizId: string): Promise<AdminActionState> {
  return approveQuizzes([quizId]);
}

/** 퀴즈 반려 → 삭제(초안은 보관할 가치가 없다). */
export async function rejectQuiz(quizId: string): Promise<AdminActionState> {
  return rejectQuizzes([quizId]);
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
