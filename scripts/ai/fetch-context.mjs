/**
 * 자동 생성 1단계 — 집필 컨텍스트 수집.
 *
 * Supabase 에서 기존 토픽·서적 목록을 읽어 .ai/context.json 으로 떨군다.
 * Claude Code 는 이 파일만 보고 주제를 고르므로, 중복 서적이 만들어지지 않는다.
 *
 * DB 접근은 이 스크립트가 전담한다(모델은 DB 자격증명을 보지 않는다).
 * 실행: node scripts/ai/fetch-context.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const [{ data: topics, error: topicErr }, { data: books, error: bookErr }] =
  await Promise.all([
    supabase.from("topics").select("slug, label, description").order("sort_order"),
    supabase
      .from("books")
      .select("topic, title")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

if (topicErr || bookErr) {
  console.error("컨텍스트 조회 실패:", topicErr?.message ?? bookErr?.message);
  process.exit(1);
}

const context = {
  topics: topics ?? [],
  existingBooks: (books ?? []).map((b) => ({ topic: b.topic, title: b.title })),
  // Tailwind 정적 리터럴만 허용(DB check 제약과 동일). 새 토픽을 만들 때 이 중에서 고른다.
  allowedAccents: [
    "text-brand",
    "text-brand-2",
    "text-accent-amber",
    "text-accent-cyan",
    "text-accent-emerald",
    "text-muted-strong",
  ],
};

await mkdir(".ai", { recursive: true });
await writeFile(".ai/context.json", JSON.stringify(context, null, 2), "utf8");

console.log(
  `컨텍스트 수집 완료 — 토픽 ${context.topics.length}개, 기존 서적 ${context.existingBooks.length}권`,
);
