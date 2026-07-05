import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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

async function getClient(): Promise<SupabaseClient | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  return createClient();
}

/** 토픽별 랜덤 퀴즈(정답 제외). random_quiz RPC 는 answer/explanation 을 반환하지 않는다. */
export async function getRandomQuiz(
  topic: string,
  difficulty?: string,
): Promise<QuizPublic | null> {
  const supabase = await getClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("random_quiz", {
    p_topic: topic,
    p_difficulty: difficulty ?? null,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  const q = data[0] as QuizPublic;
  return q;
}

/** 채점용 정답 포함 조회(server-only, 클라이언트에 반환 금지). */
export async function getQuizForGrading(id: string): Promise<QuizCanonical | null> {
  const supabase = await getClient();
  if (!supabase) return null;
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
