import type { Metadata } from "next";
import Link from "next/link";
import { getTopics } from "@/lib/wiki/topics-db";
import { getQuizCountsByTopic } from "@/lib/wiki/quizzes";
import { canonical, NOINDEX } from "@/lib/site";
import { cn } from "@/lib/utils";

// 공개 문구에서 생성/채점 방식을 언급하지 않는다(AGENTS.md). 또한 서술형·빈칸 채우기는
// 현재 출제되지 않으므로(daily-quiz.yml 은 객관식만 만든다) 있지도 않은 기능을 광고하지 않는다.
export const metadata: Metadata = {
  title: "코딩 퀴즈",
  description:
    "토픽별 랜덤 문제로 배운 내용을 점검하세요. 제출하면 바로 정답과 해설을 확인할 수 있습니다.",
  alternates: { canonical: canonical("quiz") },
  robots: NOINDEX ? { index: false, follow: false } : undefined,
};

// 토픽은 DB 가 원천(AI 가 새 토픽을 만들 수 있다). 정적으로 굳지 않도록 5분 ISR.
export const revalidate = 300;

export default async function QuizIndexPage() {
  // 서로 독립적이라 병렬로 읽는다.
  const [topics, counts] = await Promise.all([getTopics(), getQuizCountsByTopic()]);

  // 문제가 있는 토픽만 노출한다. 예전엔 모든 토픽 타일을 깔아뒀는데 퀴즈는 하루 3토픽씩만
  // 늘어나므로(daily-quiz.yml) 대부분이 빈 페이지로 이어졌다 — 헛클릭이자, 심사관에게는
  // 실질 콘텐츠가 없다는 인상을 준다. 문항 수를 함께 보여줘 클릭 전에 기대치를 맞춘다.
  const available = topics
    .map((topic) => ({ topic, count: counts[topic.slug] ?? 0 }))
    .filter(({ count }) => count > 0);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <p className="text-sm font-semibold text-brand">퀴즈</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">코딩 퀴즈</h1>
        <p className="mt-3 max-w-2xl text-muted">
          토픽을 선택하면 랜덤 문제가 출제됩니다. 답을 제출하면 바로 채점 결과와 함께 모범답안·해설을
          확인할 수 있어요.
        </p>
      </header>

      <section className="py-8">
        {available.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
            <p className="text-sm text-muted">준비된 퀴즈가 아직 없습니다.</p>
            <Link
              href="/books"
              className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
            >
              학습 서적 둘러보기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {available.map(({ topic, count }) => (
              <Link
                key={topic.slug}
                href={`/quiz/${topic.slug}`}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("text-sm font-semibold text-foreground", topic.accent)}>
                    {topic.label}
                  </p>
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">
                    {count}문항
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{topic.desc}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
