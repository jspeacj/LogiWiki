import { NextResponse } from "next/server";
import { createAdminClient, hasAdminEnv } from "@/lib/supabase/admin";
import { generateBookDraft } from "@/lib/ai/generate";
import { planDailyBooks } from "@/lib/ai/plan";
import { ADMIN_EMAIL } from "@/lib/auth/admin";
import { isAuthorizedCron } from "@/lib/cron";

/**
 * 매일 1회(Vercel Cron): AI 서적 자동 생성 파이프라인. service-role 로 실행.
 *
 *   1) 계획  — ai_settings 를 읽어 오늘 만들 권수를 정하고, Claude 에게 주제를 제안받아
 *              job 을 큐에 넣는다. 기존 토픽에 없는 분야면 토픽을 새로 만든다.
 *   2) 생성  — pending job 을 claim → Claude 로 초안 생성 → books/chapters 삽입.
 *
 * ⚠️ 결과는 **항상 status='draft'** 다. 자동 발행은 없다 — 관리자가 /admin 에서
 *    검수·승인해야만 발행된다(대규모 AI 콘텐츠 남용 방지의 불변 규칙).
 *
 * ⚠️ 유료 API. ANTHROPIC_API_KEY 가 없거나 ai_settings.enabled=false 면 아무 것도 하지 않는다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 한 번의 cron 실행에서 생성할 최대 서적 수(타임아웃·비용 방어). */
const MAX_PER_RUN = 5;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasAdminEnv() || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, skipped: "missing-env" });
  }

  const supabase = createAdminClient();

  // AI 서적 저자 = 관리자 프로필. auth.users 에서 관리자 id 조회.
  const { data: userList } = await supabase.auth.admin.listUsers();
  const adminUser = userList?.users?.find(
    (u) => u.email?.toLowerCase() === ADMIN_EMAIL,
  );
  if (!adminUser) {
    return NextResponse.json({ ok: false, error: "no-admin-account" });
  }

  // ── 1) 계획: 설정에 따라 오늘 만들 job 을 큐에 넣는다 ──────────────────────
  const { data: settings } = await supabase
    .from("ai_settings")
    .select("enabled, daily_book_count, language")
    .eq("id", true)
    .maybeSingle();

  const cfg = (settings ?? { enabled: false, daily_book_count: 0, language: "ko" }) as {
    enabled: boolean;
    daily_book_count: number;
    language: string;
  };

  let planned = { queued: 0, newTopics: [] as string[] };
  if (cfg.enabled && cfg.daily_book_count > 0) {
    // 오늘 이미 만든 AI 서적을 빼서 중복 생성을 막는다(cron 재시도·수동 호출 대비).
    const { data: madeToday } = await supabase.rpc("ai_books_today");
    const already = typeof madeToday === "number" ? madeToday : 0;
    const remaining = Math.min(
      Math.max(0, cfg.daily_book_count - already),
      MAX_PER_RUN,
    );

    if (remaining > 0) {
      try {
        planned = await planDailyBooks(
          supabase,
          remaining,
          cfg.language,
          adminUser.id,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[cron/ai] 계획 단계 실패", msg);
      }
    }
  }

  // ── 2) 생성: pending job 을 drain ──────────────────────────────────────────
  const { data: jobs } = await supabase
    .from("ai_generation_jobs")
    .select("id, topic, subtopic, language, model")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN);

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const job of jobs ?? []) {
    // 원자적 claim: pending 인 동안에만 running 으로. 크론이 겹쳐도 중복 생성되지 않는다.
    const { data: claimed } = await supabase
      .from("ai_generation_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) {
      results.push({ id: job.id, status: "skipped" });
      continue;
    }

    try {
      const bookId = await generateBookDraft(supabase, job, adminUser.id);
      await supabase
        .from("ai_generation_jobs")
        .update({
          status: "done",
          book_id: bookId,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      results.push({ id: job.id, status: "done" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("ai_generation_jobs")
        .update({
          status: "failed",
          error: msg.slice(0, 1000),
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      results.push({ id: job.id, status: "failed", error: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    settings: { enabled: cfg.enabled, daily: cfg.daily_book_count },
    planned,
    processed: results.length,
    results,
  });
}
