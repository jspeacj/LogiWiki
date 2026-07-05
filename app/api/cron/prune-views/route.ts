import { NextResponse } from "next/server";
import { createAdminClient, hasAdminEnv } from "@/lib/supabase/admin";

/**
 * 조회수 일별 버킷 보존: 400일 초과분 삭제(주간 cron). 무제한 성장 방지.
 */
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasAdminEnv()) {
    return NextResponse.json({ ok: false, skipped: "no-supabase-env" });
  }
  const cutoff = new Date(Date.now() - 400 * 86400000)
    .toISOString()
    .slice(0, 10);
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("book_view_daily")
      .delete()
      .lt("view_date", cutoff);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, cutoff });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
