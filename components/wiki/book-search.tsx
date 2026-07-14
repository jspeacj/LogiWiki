"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * 서적 제목 검색.
 *
 * 타이핑할 때마다 서버를 때리지 않도록 350ms 디바운스한다. 검색어를 바꾸면 페이지는 1로
 * 리셋하고 나머지 필터(토픽·정렬·표시개수)는 유지한다.
 */
export function BookSearch({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initial);
  // 최초 마운트 시 불필요한 push 를 막는다(초기값 == URL 값).
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const q = value.trim();
      if (q) params.set("q", q);
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 350);
    return () => clearTimeout(timer);
    // searchParams 를 의존성에 넣으면 push 직후 다시 타이머가 도므로 제외한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, pathname, router]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        strokeWidth={2}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="서적 제목 검색"
        aria-label="서적 제목 검색"
        className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-9 text-sm text-foreground placeholder:text-muted/70 transition-colors focus:border-brand/50 focus:bg-white/[0.05] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={() => setValue("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition-colors hover:text-foreground"
        >
          <X className="size-3.5" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
