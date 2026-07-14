import { NextResponse } from "next/server";
import { createAdminClient, hasAdminEnv } from "@/lib/supabase/admin";
import { generateBookDraft } from "@/lib/ai/generate";
import { ADMIN_EMAIL } from "@/lib/auth/admin";
import { isAuthorizedCron } from "@/lib/cron";

/**
 * AI 생성 job 큐 drain(Vercel Cron). service-role 로 실행.
 * pending job 을 최대 2건 claim → Claude 로 초안 생성 → books/chapters(status='draft') 삽입.
 * 자동 발행 없음(관리자 검수 후에만 발행). CRON_SECRET 검증.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CLAIM = 2;

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

  const { data: jobs } = await supabase
    .from("ai_generation_jobs")
    .select("id, topic, subtopic, language, model")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(CLAIM);

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const job of jobs ?? []) {
    // 원자적 claim: pending 인 동안에만 running 으로 바꾼다. 크론이 겹쳐 돌거나 재시도가
    // 들어와도 같은 job 을 두 번 생성하지 않는다(=> 중복 서적·중복 Claude 비용 방지).
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

  return NextResponse.json({ ok: true, processed: results.length, results });
}
