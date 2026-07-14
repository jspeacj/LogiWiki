import "server-only";
import { getReadClient } from "@/lib/supabase/read";
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
