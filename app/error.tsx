"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCw } from "lucide-react";

/**
 * 라우트 세그먼트 에러 바운더리.
 *
 * 모든 콘텐츠 라우트는 Supabase 에서 데이터를 가져오는 서버 컴포넌트다. 쿼리가
 * 던지면(장애·네트워크 등) 이 화면이 뜬다 — 예전엔 Next 기본 오류 화면(브랜드·안내·재시도
 * 없음)이 나왔다. reset() 으로 해당 세그먼트만 다시 렌더한다.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 서버/클라 로그로 원인 추적(민감정보는 남기지 않는다 — message/digest 만).
    console.error("[route error]", error.message, error.digest);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-5 py-28 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white glow-brand">
        <RotateCw className="size-7" strokeWidth={2} />
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">문제가 발생했어요</h1>
      <p className="mt-3 text-muted">
        일시적인 오류일 수 있습니다. 다시 시도해 주세요. 문제가 계속되면 잠시 후 다시
        방문해 주세요.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand to-brand-2 px-5 py-2.5 text-sm font-medium text-white transition-[filter] hover:brightness-110"
        >
          <RotateCw className="size-4" strokeWidth={2.2} />
          다시 시도
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-muted-strong transition-colors hover:border-white/20 hover:text-foreground"
        >
          <Home className="size-4" strokeWidth={2.2} />
          홈으로
        </Link>
      </div>
    </div>
  );
}
