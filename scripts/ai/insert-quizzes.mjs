/**
 * 퀴즈 자동 생성 3단계 — 검증 후 DB 에 초안으로 삽입.
 *
 * 입력: .ai/quizzes.json  (Claude Code 가 만든다)
 *
 * 규칙:
 *   - **객관식(mcq)만** 받는다. 서술형·빈칸코드는 Claude API 채점이 필요한데
 *     ANTHROPIC_API_KEY 가 없으면 채점이 안 돼 사용자 경험만 나빠진다.
 *   - status='draft' → 관리자가 /wiki/admin 에서 승인해야 출제된다.
 *   - 검증 실패 시 아무 것도 넣지 않는다(반쪽짜리 문항 방지).
 *
 * 실행: node scripts/ai/insert-quizzes.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
  process.exit(1);
}

const DIFFICULTIES = ["easy", "medium", "hard"];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

// ── 1) 산출물 로드 ───────────────────────────────────────────────────────────
let payload;
try {
  payload = JSON.parse(await readFile(".ai/quizzes.json", "utf8"));
} catch (e) {
  fail(`.ai/quizzes.json 을 읽을 수 없습니다: ${e.message}`);
}

const items = Array.isArray(payload) ? payload : payload.quizzes;
if (!Array.isArray(items) || items.length === 0) {
  fail("quizzes 배열이 비어 있습니다.");
}

// ── 2) 토픽 검증 (FK 가 최종 방어선이지만 여기서 명확한 에러를 준다) ─────────
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: topicRows } = await supabase.from("topics").select("slug");
const validTopics = new Set((topicRows ?? []).map((t) => t.slug));

// 같은 실행 안에서의 중복 출제도 막는다.
const seenPrompts = new Set();
const rows = [];

for (const [i, q] of items.entries()) {
  const at = `quizzes[${i}]`;

  if (q.type !== "mcq") {
    fail(`${at}: type 은 "mcq" 여야 합니다(서술형·빈칸코드는 유료 API 채점이 필요). 받은 값: ${q.type}`);
  }
  if (!validTopics.has(q.topic)) {
    fail(`${at}: 존재하지 않는 토픽 "${q.topic}"`);
  }
  if (typeof q.prompt !== "string" || q.prompt.trim().length < 10) {
    fail(`${at}: prompt 가 10자 미만`);
  }
  if (seenPrompts.has(q.prompt.trim())) {
    fail(`${at}: 같은 문제가 중복됐습니다`);
  }
  seenPrompts.add(q.prompt.trim());

  if (!Array.isArray(q.choices) || q.choices.length < 3 || q.choices.length > 5) {
    fail(`${at}: choices 는 3~5개여야 합니다`);
  }

  const keys = [];
  for (const [j, c] of q.choices.entries()) {
    if (typeof c?.key !== "string" || !/^[a-e]$/.test(c.key)) {
      fail(`${at}.choices[${j}]: key 는 a~e 중 하나여야 합니다`);
    }
    if (typeof c?.text !== "string" || !c.text.trim()) {
      fail(`${at}.choices[${j}]: text 누락`);
    }
    if (keys.includes(c.key)) fail(`${at}: 선택지 key 중복 (${c.key})`);
    keys.push(c.key);
  }

  // 정답 키가 실제 선택지에 없으면 영원히 맞출 수 없는 문제가 된다.
  if (typeof q.answer !== "string" || !keys.includes(q.answer)) {
    fail(`${at}: answer "${q.answer}" 가 선택지에 없습니다 (선택지: ${keys.join(",")})`);
  }

  // 해설이 없으면 틀렸을 때 배울 게 없다 → 퀴즈의 존재 이유가 없어진다.
  if (typeof q.explanation !== "string" || q.explanation.trim().length < 20) {
    fail(`${at}: explanation 이 20자 미만 — 왜 그 답인지 설명해야 합니다`);
  }

  rows.push({
    type: "mcq",
    topic: q.topic,
    difficulty: DIFFICULTIES.includes(q.difficulty) ? q.difficulty : "medium",
    language: q.language ?? "ko",
    prompt: q.prompt.trim(),
    choices: q.choices.map((c) => ({ key: c.key, text: c.text.trim() })),
    answer: q.answer,
    explanation: q.explanation.trim(),
    source: "ai",
    status: "draft", // ← 관리자 승인 후에만 출제된다.
    ai_model: "claude-code",
  });
}

// ── 3) 삽입 ──────────────────────────────────────────────────────────────────
const { error } = await supabase.from("quizzes").insert(rows);
if (error) fail(`퀴즈 삽입 실패: ${error.message}`);

const byTopic = rows.reduce((m, r) => m.set(r.topic, (m.get(r.topic) ?? 0) + 1), new Map());
console.log(`✅ 퀴즈 ${rows.length}문항 생성 완료 (초안)`);
for (const [topic, n] of byTopic) console.log(`   - ${topic}: ${n}문항`);
console.log(`   /wiki/admin 에서 검수 후 승인하세요.`);
