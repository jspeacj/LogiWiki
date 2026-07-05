import Link from "next/link";
import { TOPICS } from "@/lib/wiki/topics";
import { cn } from "@/lib/utils";

/** 토픽 진입 그리드 — 홈/토픽 인덱스에서 재사용. topic 은 facet(허브 진입점). */
export function TopicGrid({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {TOPICS.map((topic) => (
        <Link
          key={topic.slug}
          href={`/topic/${topic.slug}`}
          className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
        >
          <p className={cn("text-sm font-semibold text-foreground", topic.accent)}>
            {topic.label}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-muted">{topic.desc}</p>
        </Link>
      ))}
    </div>
  );
}
