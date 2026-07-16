import { NextResponse } from "next/server";
import { createAdminClient, hasAdminEnv } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";

/**
 * 조회수 데이터 보존(주간 cron). 무제한 성장 방지.
 *  - book_view_daily  : 400일 초과분 삭제(랭킹 최대 윈도 365일 + 여유).
 *  - book_view_dedupe : 7일 초과분 삭제(0015). 조회 1건당 1행이라 가장 빨리 자라는데,
 *                       당일 중복만 걸러내면 되므로 길게 들고 있을 이유가 없다.
 */
export const dynamic = "force-dynamic";

const DAILY_KEEP_DAYS = 400;
const DEDUPE_KEEP_DAYS = 7;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasAdminEnv()) {
    return NextResponse.json({ ok: false, skipped: "no-supabase-env" });
  }
  const cutoff = new Date(Date.now() - DAILY_KEEP_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("book_view_daily")
      .delete()
      .lt("view_date", cutoff);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // 원장은 RLS 정책이 없어 PostgREST 로는 못 지운다(설계상 클라이언트 접근 차단) →
    // definer RPC 로 지운다.
    const { data: pruned, error: dedupeError } = await supabase.rpc("prune_view_dedupe", {
      p_keep_days: DEDUPE_KEEP_DAYS,
    });
    if (dedupeError) {
      return NextResponse.json({ ok: false, error: dedupeError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, cutoff, dedupePruned: pruned ?? 0 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
