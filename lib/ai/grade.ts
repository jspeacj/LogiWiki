import "server-only";
import { claude, MODEL_DRAFT } from "./claude";

/**
 * 퀴즈 자유서술/코드 답안 채점(Claude). API 오류 시 채점 보류(is_correct=null) 로 폴백.
 * 절대 throw 하지 않는다(호출부 채점 플로우를 막지 않도록).
 */

export interface GradeResult {
  correct: boolean | null;
  score: number; // 0~1
  feedback: string;
}

const GRADE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    correct: { type: "boolean" },
    score: { type: "number" },
    feedback: { type: "string" },
  },
  required: ["correct", "score", "feedback"],
} as const;

const GRADE_SYSTEM = `당신은 공정하지만 엄격한 프로그래밍 강사입니다. 학생 답안을 정답/모범답안과 비교해 채점합니다.
- score 는 0.0~1.0. 핵심 개념이 맞으면 부분점수를 인정합니다.
- correct 는 score >= 0.7 이면 true.
- feedback 은 학생의 언어로 2~3문장. 무엇이 맞고 무엇이 부족한지 구체적으로.`;

export async function gradeFreeText(input: {
  type: "short" | "fill_code";
  prompt: string;
  answer: string;
  explanation?: string;
  submitted: string;
  language?: string;
}): Promise<GradeResult> {
  try {
    const user = [
      `유형: ${input.type === "fill_code" ? "빈칸 코드" : "서술형"}`,
      `문제: ${input.prompt}`,
      `모범답안: ${input.answer}`,
      input.explanation ? `해설: ${input.explanation}` : "",
      `학생답안: ${input.submitted}`,
      `채점 언어: ${input.language ?? "ko"}`,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await claude.completeJSON<GradeResult>({
      model: MODEL_DRAFT,
      system: GRADE_SYSTEM,
      user,
      schema: GRADE_SCHEMA,
      maxTokens: 512,
    });
    return {
      correct: typeof res.correct === "boolean" ? res.correct : null,
      score: typeof res.score === "number" ? Math.max(0, Math.min(1, res.score)) : 0,
      feedback: res.feedback ?? "",
    };
  } catch {
    return {
      correct: null,
      score: 0,
      feedback: "자동 채점을 일시적으로 사용할 수 없습니다. 모범답안과 비교해 확인해 주세요.",
    };
  }
}
