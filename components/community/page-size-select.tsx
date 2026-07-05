"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PAGE_SIZE_OPTIONS } from "@/lib/community/types";

/** 페이지당 게시글 수 선택. 변경 시 ?per= 갱신(페이지는 1로 리셋, 다른 쿼리 유지). */
export function PageSizeSelect({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("per", e.target.value);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted">
      표시 개수
      <select
        value={value}
        onChange={onChange}
        className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-foreground transition-colors hover:border-white/20 focus:border-brand/50 focus:outline-none [&>option]:bg-background-elev [&>option]:text-foreground"
      >
        {PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
