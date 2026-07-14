"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 페이지 이동(게시판·서적 목록 공용).
 *
 * 현재 쿼리(정렬·토픽·검색어 등)를 보존한 채 ?page= 만 갈아끼운다.
 * 1페이지는 파라미터를 지워 URL 을 깔끔하게 유지한다.
 * 앞뒤 페이지 번호를 함께 노출해 현재 위치를 한눈에 알 수 있게 한다.
 */
export function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function href(p: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function go(p: number) {
    router.push(href(p), { scroll: false });
  }

  // 현재 페이지 주변 최대 5개만 노출(페이지가 많아도 UI 가 넘치지 않도록).
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const arrow =
    "inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-muted-strong transition-colors hover:border-white/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <nav
      className="mt-8 flex items-center justify-center gap-1.5"
      aria-label="페이지"
    >
      <button
        type="button"
        aria-label="이전 페이지"
        className={arrow}
        onClick={() => go(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft className="size-4" strokeWidth={2.2} />
      </button>

      {start > 1 && (
        <span className="px-1 text-sm text-muted" aria-hidden>
          …
        </span>
      )}

      {pages.map((p) => {
        const active = p === page;
        return (
          <button
            key={p}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => go(p)}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-xl text-sm font-medium tabular-nums transition-colors",
              active
                ? "bg-gradient-to-br from-brand to-brand-2 text-white"
                : "border border-white/10 bg-white/[0.03] text-muted-strong hover:border-white/20 hover:text-foreground",
            )}
          >
            {p}
          </button>
        );
      })}

      {end < totalPages && (
        <span className="px-1 text-sm text-muted" aria-hidden>
          …
        </span>
      )}

      <button
        type="button"
        aria-label="다음 페이지"
        className={arrow}
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
      >
        <ChevronRight className="size-4" strokeWidth={2.2} />
      </button>
    </nav>
  );
}
