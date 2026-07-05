import Link from "next/link";
import { Hash } from "lucide-react";
import type { ChapterNode } from "@/lib/wiki/types";
import { cn } from "@/lib/utils";

/**
 * 서적 목차 트리. 현재 챕터 슬러그를 강조한다.
 * Link → basePath(/wiki) 자동 적용.
 */
export function BookToc({
  slug,
  chapters,
  currentSlug,
  className,
}: {
  slug: string;
  chapters: ChapterNode[];
  currentSlug?: string;
  className?: string;
}) {
  if (chapters.length === 0) {
    return (
      <p className={cn("text-sm text-muted", className)}>
        아직 챕터가 없습니다.
      </p>
    );
  }
  return (
    <nav className={cn("text-sm", className)} aria-label="목차">
      <ul className="space-y-0.5">
        {chapters.map((ch) => (
          <TocNode key={ch.id} slug={slug} node={ch} currentSlug={currentSlug} depth={0} />
        ))}
      </ul>
    </nav>
  );
}

function TocNode({
  slug,
  node,
  currentSlug,
  depth,
}: {
  slug: string;
  node: ChapterNode;
  currentSlug?: string;
  depth: number;
}) {
  const active = node.slug === currentSlug;
  return (
    <li>
      <Link
        href={`/book/${slug}/${node.slug}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors",
          active
            ? "bg-brand/15 font-medium text-foreground"
            : "text-muted hover:bg-white/[0.05] hover:text-foreground",
        )}
        style={{ paddingLeft: `${0.75 + depth * 0.85}rem` }}
      >
        {depth > 0 && <Hash className="size-3 shrink-0 text-muted/60" strokeWidth={2} />}
        <span className="truncate">{node.title}</span>
      </Link>
      {node.children.length > 0 && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <TocNode
              key={child.id}
              slug={slug}
              node={child}
              currentSlug={currentSlug}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** 트리를 평탄화해 이전/다음 네비게이션에 쓸 순서 배열을 만든다. */
export function flattenChapters(chapters: ChapterNode[]): ChapterNode[] {
  const out: ChapterNode[] = [];
  const walk = (list: ChapterNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children.length) walk(n.children);
    }
  };
  walk(chapters);
  return out;
}
