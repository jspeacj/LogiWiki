"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Clock, Eye, ThumbsUp } from "lucide-react";
import type { BookSort } from "@/lib/wiki/types";
import { PageSizeSelect } from "@/components/ui/page-size-select";
import { cn } from "@/lib/utils";

const SORT_TABS: { value: BookSort; label: string; icon: typeof Clock }[] = [
  { value: "recent", label: "최신순", icon: Clock },
  { value: "popular", label: "조회순", icon: Eye },
  { value: "recommended", label: "추천순", icon: ThumbsUp },
];

/** 서적 목록 상단 컨트롤: 총 개수 · 정렬(세그먼트) · 표시 개수. */
export function BookListControls({
  total,
  sort,
}: {
  total: number;
  sort: BookSort;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** 정렬만 바꾸고 나머지 쿼리는 유지. 페이지는 1로 리셋. */
  function sortHref(next: BookSort): string {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "recent") params.delete("sort");
    else params.set("sort", next);
    params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        서적 <span className="font-semibold text-foreground tabular-nums">{total}</span>권
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <nav
          className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1"
          aria-label="정렬"
        >
          {SORT_TABS.map((tab) => {
            const active = tab.value === sort;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.value}
                href={sortHref(tab.value)}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/[0.08] text-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" strokeWidth={2.2} />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <PageSizeSelect value={Number(searchParams.get("per")) || 10} />
      </div>
    </div>
  );
}
