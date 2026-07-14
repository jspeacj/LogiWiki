import type { Metadata } from "next";
import Link from "next/link";
import { getTopics } from "@/lib/wiki/topics-db";
import { canonical, NOINDEX } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "코딩 퀴즈",
  description: "토픽별 랜덤 코딩 퀴즈로 배운 내용을 점검하세요. 객관식·서술형·빈칸 채우기 문제를 AI가 채점합니다.",
  alternates: { canonical: canonical("quiz") },
  robots: NOINDEX ? { index: false, follow: false } : undefined,
};

// 토픽은 DB 가 원천(AI 가 새 토픽을 만들 수 있다). 정적으로 굳지 않도록 5분 ISR.
export const revalidate = 300;

export default async function QuizIndexPage() {
  const topics = await getTopics();
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <p className="text-sm font-semibold text-brand">퀴즈</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">코딩 퀴즈</h1>
        <p className="mt-3 max-w-2xl text-muted">
          토픽을 선택하면 랜덤 문제가 출제됩니다. 정답을 제출하면 AI가 바로 채점하고 해설을 알려드려요.
        </p>
      </header>

      <section className="py-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {topics.map((topic) => (
            <Link
              key={topic.slug}
              href={`/quiz/${topic.slug}`}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
            >
              <p className={cn("text-sm font-semibold text-foreground", topic.accent)}>
                {topic.label}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{topic.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
