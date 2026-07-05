"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getQuizForGrading } from "@/lib/wiki/quizzes";
import { gradeFreeText } from "@/lib/ai/grade";

export interface QuizGradeState {
  ok?: boolean;
  correct: boolean | null;
  score: number;
  feedback: string;
  answer: string;
  explanation: string;
  error?: string;
}

const Schema = z.object({
  quizId: z.string().uuid(),
  submitted: z.string().trim().min(1).max(4000),
});

function normalizeCode(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * 퀴즈 채점.
 * mcq=키 정확비교(즉시) / fill_code=정규화 비교 후 불일치 시 Claude 의미판정 / short=Claude 채점.
 * 채점 후에는 정답·해설을 함께 반환한다(공개 안전).
 */
export async function gradeQuiz(
  quizId: string,
  submitted: string,
): Promise<QuizGradeState> {
  const parsed = Schema.safeParse({ quizId, submitted });
  if (!parsed.success) {
    return { correct: null, score: 0, feedback: "", answer: "", explanation: "", error: "VALIDATION" };
  }

  const quiz = await getQuizForGrading(parsed.data.quizId);
  if (!quiz) {
    return { correct: null, score: 0, feedback: "", answer: "", explanation: "", error: "NOT_FOUND" };
  }

  const sub = parsed.data.submitted;
  let correct: boolean | null = null;
  let score = 0;
  let feedback = "";
  let gradedBy: "auto" | "ai" = "auto";

  if (quiz.type === "mcq") {
    correct = sub.trim().toLowerCase() === quiz.answer.trim().toLowerCase();
    score = correct ? 1 : 0;
    feedback = correct ? "정답입니다!" : "아쉽지만 오답입니다.";
  } else if (quiz.type === "fill_code" && normalizeCode(sub) === normalizeCode(quiz.answer)) {
    correct = true;
    score = 1;
    feedback = "정답입니다!";
  } else {
    // 서술형 또는 코드 불일치 → AI 채점.
    const g = await gradeFreeText({
      type: quiz.type === "fill_code" ? "fill_code" : "short",
      prompt: quiz.prompt,
      answer: quiz.answer,
      explanation: quiz.explanation,
      submitted: sub,
      language: quiz.language,
    });
    correct = g.correct;
    score = g.score;
    feedback = g.feedback;
    gradedBy = "ai";
  }

  // 로그인 사용자면 시도 기록(RLS: 본인만).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("quiz_attempts").insert({
      quiz_id: quiz.id,
      user_id: user.id,
      type: quiz.type,
      submitted: sub,
      is_correct: correct,
      score,
      feedback,
      graded_by: gradedBy,
    });
  }

  return {
    ok: true,
    correct,
    score,
    feedback,
    answer: quiz.answer,
    explanation: quiz.explanation,
  };
}
