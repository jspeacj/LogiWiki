"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type Category,
} from "@/lib/community/types";
import { cn } from "@/lib/utils";

/** 카테고리 탭. 선택 시 ?category= 갱신(페이지는 1로 리셋, 검색어 유지). */
export function CategoryFilter({ active }: { active: Category | "all" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(cat: Category | "all") {
    const params = new URLSearchParams(searchParams.toString());
    if (cat === "all") params.delete("category");
    else params.set("category", cat);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const tabs: { key: Category | "all"; label: string }[] = [
    { key: "all", label: "전체" },
    ...CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABEL[c] })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(({ key, label }) => {
        const on = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => select(key)}
            aria-pressed={on}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              on
                ? "border-brand/40 bg-brand/15 text-foreground"
                : "border-white/10 bg-white/[0.03] text-muted-strong hover:border-white/20 hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
