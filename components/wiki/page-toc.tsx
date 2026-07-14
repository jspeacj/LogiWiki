"use client";

import { useEffect, useState } from "react";
import type { TocHeading } from "@/lib/wiki/markdown";
import { cn } from "@/lib/utils";

/**
 * 챕터 안의 섹션 목차("이 페이지에서") + 스크롤 스파이.
 *
 * 좌측 목차가 "책의 챕터" 라면 이건 "챕터 안의 절" 이다. 신뢰할 만한 기술 문서 사이트
 * (MDN·Next 문서·위키독스)가 예외 없이 갖고 있는 것이고, 긴 챕터에서 원하는 절로 바로
 * 뛰어들 수 있게 해준다. 제목에 id 가 없어 그동안 만들 수 없었다(lib/wiki/markdown.ts).
 */
export function PageToc({ headings }: { headings: TocHeading[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (headings.length === 0) return;

    const targets = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    // 상단 스티키 헤더(약 4rem) 바로 아래에 걸친 제목을 "현재 위치" 로 본다.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-72px 0px -70% 0px", threshold: 0 },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null; // 절이 하나뿐이면 목차가 의미 없다.

  return (
    <nav aria-label="이 페이지에서" className="text-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        이 페이지에서
      </p>
      <ul className="space-y-1.5 border-l border-white/10">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              aria-current={activeId === h.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l py-0.5 pl-3 leading-snug transition-colors",
                h.level === 3 && "pl-6",
                activeId === h.id
                  ? "border-brand-2 text-foreground"
                  : "border-transparent text-muted hover:text-muted-strong",
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
