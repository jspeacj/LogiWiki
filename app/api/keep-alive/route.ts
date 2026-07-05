import { NextResponse } from "next/server";
import { createAdminClient, hasAdminEnv } from "@/lib/supabase/admin";

/**
 * Supabase 무료 플랜 자동 일시정지(7일) 방지용 keep-alive.
 * Vercel Cron 이 매일 호출한다. CRON_SECRET 설정 시 Bearer 토큰 검증.
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
  try {
    const supabase = createAdminClient();
    await supabase.from("profiles").select("id").limit(1);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
