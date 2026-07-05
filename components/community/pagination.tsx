"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

  function go(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const btn =
    "inline-flex h-9 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-muted-strong transition-colors hover:border-white/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav className="mt-6 flex items-center justify-center gap-3">
      <button
        type="button"
        className={btn}
        onClick={() => go(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft className="size-4" />
        이전
      </button>
      <span className="text-sm text-muted tabular-nums">
        {page} / {totalPages} 페이지
      </span>
      <button
        type="button"
        className={cn(btn, "flex-row-reverse")}
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
      >
        <ChevronRight className="size-4" />
        다음
      </button>
    </nav>
  );
}
