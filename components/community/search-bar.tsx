"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

/** 제목·닉네임 검색. 제출 시 ?q= 갱신(페이지 1로 리셋, 카테고리 유지). */
export function SearchBar({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initial);

  function apply(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    const term = q.trim();
    if (term) params.set("q", term);
    else params.delete("q");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply(value);
      }}
      className="relative w-full sm:max-w-xs"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="제목 또는 닉네임으로 검색"
        aria-label="검색"
        className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-9 text-sm text-foreground placeholder:text-muted/70 transition-colors focus:border-brand/50 focus:bg-white/[0.05] focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            apply("");
          }}
          aria-label="검색어 지우기"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </form>
  );
}
