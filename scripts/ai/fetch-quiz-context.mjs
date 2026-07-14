/**
 * 퀴즈 자동 생성 1단계 — 출제 컨텍스트 수집.
 *
 * 랜덤 토픽을 고르는 일은 **스크립트가 한다**(모델에게 맡기면 매번 인기 토픽으로 쏠린다).
 * 퀴즈가 적은 토픽에 가중치를 줘서, 특정 토픽만 문제가 쌓이는 것을 막는다.
 *
 * 출력: .ai/quiz-context.json
 * 실행: node scripts/ai/fetch-quiz-context.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** 하루에 고를 토픽 수 × 토픽당 문항 수 = 총 생성 문항. */
const TOPIC_COUNT = Number(process.env.QUIZ_TOPIC_COUNT ?? 3);
const PER_TOPIC = Number(process.env.QUIZ_PER_TOPIC ?? 2);

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const [{ data: topicRows, error: topicErr }, { data: quizRows, error: quizErr }] =
  await Promise.all([
    supabase.from("topics").select("slug, label, description").order("sort_order"),
    supabase.from("quizzes").select("topic, prompt"),
  ]);

if (topicErr || quizErr) {
  console.error("컨텍스트 조회 실패:", topicErr?.message ?? quizErr?.message);
  process.exit(1);
}

const topics = topicRows ?? [];
const quizzes = quizRows ?? [];

if (topics.length === 0) {
  console.error("토픽이 없습니다. 0011 마이그레이션을 실행했는지 확인하세요.");
  process.exit(1);
}

// 토픽별 기존 문항 수
const countByTopic = new Map();
for (const q of quizzes) {
  countByTopic.set(q.topic, (countByTopic.get(q.topic) ?? 0) + 1);
}

/**
 * 문항이 적은 토픽일수록 뽑힐 확률을 높인다(가중 랜덤).
 * 완전 랜덤이면 이미 문항이 많은 토픽에도 계속 쌓여 편중된다.
 */
function pickWeighted(pool, n) {
  const chosen = [];
  const candidates = [...pool];

  for (let i = 0; i < n && candidates.length > 0; i++) {
    const weights = candidates.map((t) => 1 / (1 + (countByTopic.get(t.slug) ?? 0)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;

    let idx = 0;
    for (; idx < candidates.length; idx++) {
      r -= weights[idx];
      if (r <= 0) break;
    }
    chosen.push(candidates[Math.min(idx, candidates.length - 1)]);
    candidates.splice(Math.min(idx, candidates.length - 1), 1);
  }
  return chosen;
}

const selected = pickWeighted(topics, Math.min(TOPIC_COUNT, topics.length));

const context = {
  perTopic: PER_TOPIC,
  // 선정된 토픽 + 그 토픽의 기존 문제(중복 출제 방지용)
  targets: selected.map((t) => ({
    slug: t.slug,
    label: t.label,
    description: t.description,
    existingCount: countByTopic.get(t.slug) ?? 0,
    existingPrompts: quizzes
      .filter((q) => q.topic === t.slug)
      .map((q) => q.prompt)
      .slice(0, 50),
  })),
};

await mkdir(".ai", { recursive: true });
await writeFile(".ai/quiz-context.json", JSON.stringify(context, null, 2), "utf8");

console.log(`출제 대상 ${selected.length}개 토픽 (토픽당 ${PER_TOPIC}문항):`);
for (const t of context.targets) {
  console.log(`  - ${t.label} (${t.slug}) — 기존 ${t.existingCount}문항`);
}
