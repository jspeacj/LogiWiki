import "server-only";
import { unstable_cache } from "next/cache";
import { getPublicClient, getReadClient } from "@/lib/supabase/read";
import { createAdminClient, hasAdminEnv } from "@/lib/supabase/admin";

export type QuizType = "mcq" | "short" | "fill_code";

/** 공개 serve 형태(정답·해설 제외). */
export interface QuizPublic {
  id: string;
  type: QuizType;
  topic: string;
  difficulty: string;
  language: string;
  prompt: string;
  code_template: string | null;
  choices: Array<{ key: string; text: string }> | null;
}

/** 채점용(정답·해설 포함, server-only). */
export interface QuizCanonical extends QuizPublic {
  answer: string;
  explanation: string;
}


/** 5분. 퀴즈는 하루 1회(daily-quiz.yml) 승인 시에만 늘어난다. */
const QUIZ_COUNT_TTL_SECONDS = 300;

/**
 * 토픽별 발행 퀴즈 수.
 *
 * 왜 필요한가 — /quiz 는 **모든** 토픽 타일을 깔아놨는데, 퀴즈는 하루 3토픽 × 2문항씩만
 * 늘어난다(daily-quiz.yml). 그래서 대부분의 타일이 "아직 이 토픽의 퀴즈가 없습니다" 로
 * 이어졌다 — 사용자에겐 헛클릭이고, AdSense 심사관에겐 "실질 콘텐츠 없음" 의 전형이다.
 * 이 카운트로 빈 토픽을 걸러 낸다.
 *
 * 정답 컬럼은 건드리지 않는다(0008 에서 anon 의 SELECT 권한이 없다) — id 만 센다.
 */
export const getQuizCountsByTopic = unstable_cache(
  async function fetchQuizCountsByTopic(): Promise<Record<string, number>> {
    const supabase = getPublicClient();
    if (!supabase) return {};
    // 집계 RPC 없이 토픽 컬럼만 훑는다. 퀴즈는 수천 건 규모를 넘지 않으므로 충분하다.
    const { data, error } = await supabase
      .from("quizzes")
      .select("topic")
      .eq("status", "published");
    if (error || !data) {
      if (error) {
        console.error("[wiki/quizzes] getQuizCountsByTopic 실패", {
          code: error.code,
          message: error.message,
        });
      }
      return {};
    }
    const counts: Record<string, number> = {};
    for (const row of data as Array<{ topic: string }>) {
      counts[row.topic] = (counts[row.topic] ?? 0) + 1;
    }
    return counts;
  },
  ["wiki-quiz-counts"],
  { revalidate: QUIZ_COUNT_TTL_SECONDS, tags: ["quizzes"] },
);

/** 토픽별 랜덤 퀴즈(정답 제외). random_quiz RPC 는 answer/explanation 을 반환하지 않는다. */
export async function getRandomQuiz(
  topic: string,
  difficulty?: string,
): Promise<QuizPublic | null> {
  const supabase = await getReadClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("random_quiz", {
    p_topic: topic,
    p_difficulty: difficulty ?? null,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as QuizPublic;
}

/**
 * 채점용 정답 포함 조회(server-only, 클라이언트에 반환 금지).
 *
 * 반드시 service_role 로 읽는다: anon/authenticated 롤은 0008 마이그레이션에서
 * quizzes.answer/explanation 컬럼 SELECT 권한이 제거됐다(브라우저가 anon 키로
 * PostgREST 를 직접 때려 정답을 긁어가는 것을 막기 위함). 즉 유저 세션 클라이언트로는
 * 이 쿼리가 애초에 실패한다.
 */
export async function getQuizForGrading(id: string): Promise<QuizCanonical | null> {
  if (!hasAdminEnv()) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select(
      "id, type, topic, difficulty, language, prompt, code_template, choices, answer, explanation",
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;
  return data as QuizCanonical;
}
