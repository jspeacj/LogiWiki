/**
 * 자동 생성 3단계 — 집필 결과를 DB 에 초안으로 삽입.
 *
 * Claude Code 가 쓴 .ai/book.json 을 **엄격하게 검증**한 뒤 Supabase 에 넣는다.
 *   - 서적은 언제나 status='draft', source='ai'  → 관리자 검수·승인 후에만 발행된다.
 *   - 기존에 없는 토픽이면 topics 행을 먼저 만든다(source='ai').
 *   - 검증 실패 시 아무 것도 넣지 않고 종료 코드 1 로 실패시킨다(반쪽짜리 서적 방지).
 *
 * 실행: node scripts/ai/insert-book.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = (process.env.ADMIN_EMAIL ?? "jspeacj@gmail.com").toLowerCase();

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
  process.exit(1);
}

const ACCENTS = [
  "text-brand",
  "text-brand-2",
  "text-accent-amber",
  "text-accent-cyan",
  "text-accent-emerald",
  "text-muted-strong",
];

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}$/;

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

// ── 1) 모델 산출물 로드 + 검증 ────────────────────────────────────────────────
let book;
try {
  book = JSON.parse(await readFile(".ai/book.json", "utf8"));
} catch (e) {
  fail(`.ai/book.json 을 읽을 수 없습니다: ${e.message}`);
}

const need = (cond, msg) => {
  if (!cond) fail(`검증 실패 — ${msg}`);
};

need(typeof book.topic_slug === "string" && SLUG_RE.test(book.topic_slug), "topic_slug 형식 오류");
// slug 는 반드시 ASCII 여야 한다. 한글 slug 를 쓰면 PostgREST 필터가 실패해
// (`?slug=eq.한글` → Something went wrong) 서적 페이지가 통째로 404 가 된다.
need(
  typeof book.slug === "string" && /^[a-z0-9][a-z0-9-]{2,59}$/.test(book.slug),
  "slug 는 영문 소문자·숫자·하이픈만(3~60자). 한글 slug 는 조회가 깨진다",
);
need(typeof book.title === "string" && book.title.trim().length >= 2, "title 누락");
need(typeof book.description === "string" && book.description.trim().length >= 10, "description 누락");
need(Array.isArray(book.chapters) && book.chapters.length >= 3, "chapters 가 3개 미만");

for (const [i, ch] of book.chapters.entries()) {
  need(typeof ch.slug === "string" && SLUG_RE.test(ch.slug), `chapters[${i}].slug 형식 오류`);
  need(typeof ch.title === "string" && ch.title.trim(), `chapters[${i}].title 누락`);
  // 본문이 너무 짧으면 교과서 품질이 아니다 → 실패시켜 재시도하게 한다.
  need(typeof ch.body === "string" && ch.body.trim().length >= 400, `chapters[${i}].body 가 400자 미만`);
}

// 챕터 slug 중복은 (book_id, slug) 유니크 제약에 걸린다 → 미리 잡는다.
const slugs = new Set();
for (const ch of book.chapters) {
  need(!slugs.has(ch.slug), `챕터 slug 중복: ${ch.slug}`);
  slugs.add(ch.slug);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// ── 2) 저자 = 관리자 프로필 ──────────────────────────────────────────────────
const { data: userList } = await supabase.auth.admin.listUsers();
const admin = userList?.users?.find((u) => u.email?.toLowerCase() === adminEmail);
if (!admin) fail(`관리자 계정(${adminEmail})을 찾을 수 없습니다. 앱에서 먼저 가입하세요.`);

// ── 3) 토픽 — 없으면 생성 ────────────────────────────────────────────────────
const { data: existingTopic } = await supabase
  .from("topics")
  .select("slug")
  .eq("slug", book.topic_slug)
  .maybeSingle();

if (!existingTopic) {
  const accent = ACCENTS.includes(book.topic_accent) ? book.topic_accent : "text-brand";
  const { error } = await supabase.from("topics").insert({
    slug: book.topic_slug,
    label: (book.topic_label || book.topic_slug).slice(0, 40),
    description: (book.topic_description || "").slice(0, 200),
    accent,
    sort_order: 9000,
    source: "ai",
  });
  if (error) fail(`토픽 생성 실패: ${error.message}`);
  console.log(`🆕 새 토픽 생성: ${book.topic_slug}`);
}

// ── 4) 서적 — 항상 draft ─────────────────────────────────────────────────────
// slug 는 위에서 ASCII 로 검증됐다. 중복 방지용 접미사만 붙인다.
const bookSlug = `${book.slug}-${Date.now().toString(36).slice(-5)}`;

const { data: created, error: bookErr } = await supabase
  .from("books")
  .insert({
    slug: bookSlug,
    language: book.language ?? "ko",
    title: book.title.trim(),
    description: book.description.trim(),
    topic: book.topic_slug,
    author_id: admin.id,
    source: "ai",
    status: "draft", // ← 자동 발행 없음. 관리자 승인 후에만 published.
    ai_model: "claude-code",
  })
  .select("id")
  .single();

if (bookErr || !created) fail(`서적 생성 실패: ${bookErr?.message}`);

// ── 5) 챕터 ──────────────────────────────────────────────────────────────────
const rows = book.chapters.map((ch, i) => ({
  book_id: created.id,
  slug: ch.slug,
  title: ch.title.trim(),
  body: ch.body,
  sort_order: (i + 1) * 1000,
}));

const { error: chErr } = await supabase.from("chapters").insert(rows);
if (chErr) {
  // 챕터가 없으면 반쪽짜리 서적이 검수 큐에 남는다 → 서적도 되돌린다.
  await supabase.from("books").delete().eq("id", created.id);
  fail(`챕터 생성 실패(서적 롤백함): ${chErr.message}`);
}

console.log(`✅ 초안 생성 완료 — "${book.title}" (${rows.length}개 챕터)`);
console.log(`   /wiki/admin/books 에서 검수 후 발행하세요.`);
