import Link from "next/link";
import { getTopicsWithBooks } from "@/lib/wiki/queries";
import { cn } from "@/lib/utils";

/**
 * 토픽 진입 그리드 — 홈/토픽 인덱스에서 재사용. topic 은 facet(허브 진입점).
 * 토픽 목록은 DB 가 원천이므로 AI 가 새로 만든 토픽도 자동으로 노출된다.
 *
 * 발행 서적이 있는 토픽만 건다(getTopicsWithBooks). 빈 토픽 타일은 헛클릭이고 AdSense
 * 심사관에겐 "실질 콘텐츠 없음" 신호다. 발행 서적이 0권이면 전체 토픽으로 폴백한다.
 */
export async function TopicGrid({ className }: { className?: string }) {
  const topics = await getTopicsWithBooks();

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {topics.map((topic) => (
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
