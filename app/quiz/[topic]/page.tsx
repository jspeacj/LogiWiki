import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRandomQuiz } from "@/lib/wiki/quizzes";
import { getTopicBySlug } from "@/lib/wiki/topics-db";
import { canonical } from "@/lib/site";
import { QuizRunner } from "@/components/wiki/quiz-runner";

export const dynamic = "force-dynamic";

type Params = { topic: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { topic } = await params;
  const meta = await getTopicBySlug(topic);
  if (!meta) {
    return { title: "토픽을 찾을 수 없습니다", robots: { index: false, follow: false } };
  }
  return {
    title: `${meta.label} 퀴즈`,
    description: `${meta.label} 랜덤 코딩 퀴즈를 풀고 바로 정답과 해설을 확인해 보세요.`,
    alternates: { canonical: canonical(`quiz/${topic}`) },
    robots: { index: false, follow: false },
  };
}

export default async function QuizTopicPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { topic } = await params;
  const meta = await getTopicBySlug(topic);
  if (!meta) notFound();

  const quiz = await getRandomQuiz(topic);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <p className="text-sm font-semibold text-brand">퀴즈</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {meta.label} 퀴즈
        </h1>
      </header>

      <section className="py-8">
        <QuizRunner quiz={quiz} />
      </section>
    </div>
  );
}
