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
 * 지금 채점할 수 있는 유형만 낸다 — null 이면 전체 유형.
 *
 * 서술형(short)·빈칸코드(fill_code)는 Claude API 로 채점한다(lib/ai/grade.ts). 키가 없으면
 * 그 채점은 실패하고 사용자는 답을 제출한 뒤에야 "채점할 수 없다" 를 받는다. **낼 수 없는
 * 문제를 내지 않는 게 맞다** — AGENTS.md: 없는 기능을 광고하지 않는다, 심사관이 눌러 보고
 * 깨지는 기능은 그 자체로 감점.
 *
 * 키가 생기면 이 함수가 null 을 돌려주므로 서술형이 **자동으로 되살아난다**(DB 작업 없음).
 * 그래서 'mcq' 를 DB(0016)나 데이터에 박지 않았다 — 이건 런타임 상태이지 데이터의 성질이 아니다.
 */
function servableQuizType(): "mcq" | null {
  return process.env.ANTHROPIC_API_KEY ? null : "mcq";
}

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
    // 유형 필터는 getRandomQuiz 와 **같은 기준**이어야 한다 — 여기서만 세면 "3문항" 이라고
    // 해놓고 실제로는 1문항만 나오는(나머지는 채점 불가라 걸러지는) 화면이 된다.
    const type = servableQuizType();
    let query = supabase.from("quizzes").select("topic").eq("status", "published");
    if (type) query = query.eq("type", type);
    const { data, error } = await query;
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

/**
 * 토픽별 랜덤 퀴즈(정답 제외). random_quiz RPC 는 answer/explanation 을 반환하지 않는다.
 *
 * p_type 은 0016 에서 추가됐다 — 채점할 수 없는 유형이 출제되지 않게 한다(servableQuizType).
 * ⚠️ 0016 을 실행하지 않은 DB 는 3인자 시그니처가 없어 이 호출이 실패한다(→ 퀴즈 없음).
 */
export async function getRandomQuiz(
  topic: string,
  difficulty?: string,
): Promise<QuizPublic | null> {
  const supabase = await getReadClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("random_quiz", {
    p_topic: topic,
    p_difficulty: difficulty ?? null,
    p_type: servableQuizType(),
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
