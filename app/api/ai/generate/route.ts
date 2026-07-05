import { NextResponse } from "next/server";
import { createAdminClient, hasAdminEnv } from "@/lib/supabase/admin";
import { generateBookDraft } from "@/lib/ai/generate";
import { ADMIN_EMAIL } from "@/lib/auth/admin";

/**
 * AI 생성 job 큐 drain(Vercel Cron). service-role 로 실행.
 * pending job 을 최대 2건 claim → Claude 로 초안 생성 → books/chapters(status='draft') 삽입.
 * 자동 발행 없음(관리자 검수 후에만 발행). CRON_SECRET 검증.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CLAIM = 2;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
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
    await supabase
      .from("ai_generation_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", job.id);
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
