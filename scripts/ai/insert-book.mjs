/**
 * 자동 생성 3단계 — 집필 결과를 조립·검증해 DB 에 초안으로 삽입.
 *
 * 입력(Claude Code 가 만든다):
 *   .ai/outline.json          기획안(토픽·제목·설명·챕터 목록)
 *   .ai/chapters/<slug>.md    챕터별 본문 (파일 하나 = 챕터 하나)
 *
 * 왜 챕터를 **파일로 분리**하는가:
 *   예전엔 book.json 하나에 모든 챕터 본문을 넣었는데, 분량이 커질수록 거대한 JSON 안에
 *   마크다운을 이스케이프해 담아야 해서 깨지기 쉬웠다(코드블록의 백틱·따옴표·줄바꿈).
 *   마크다운은 마크다운 파일로 쓰는 것이 자연스럽고, 실패해도 어느 챕터인지 즉시 보인다.
 *
 * 규칙:
 *   - 서적은 언제나 status='draft', source='ai'  → 관리자 검수·승인 후에만 발행된다.
 *   - 기존에 없는 토픽이면 topics 행을 먼저 만든다(source='ai').
 *   - slug 는 ASCII 만. 한글 slug 는 PostgREST 필터를 깨뜨려 페이지가 404 가 된다.
 *   - 검증 실패 시 아무 것도 넣지 않고 종료 코드 1(반쪽짜리 서적 방지).
 *
 * 실행: node scripts/ai/insert-book.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

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

const TOPIC_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,59}$/;

/** 품질 기준 — 여기 미달이면 삽입하지 않는다. */
const MIN_CHAPTERS = 6;
const MAX_CHAPTERS = 14;
const MIN_BODY_CHARS = 1200;
const MIN_DIAGRAMS = 2;

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

const need = (cond, msg) => {
  if (!cond) fail(`검증 실패 — ${msg}`);
};

/**
 * 코드펜스(```) 안쪽을 제외하고 각 줄을 순회한다.
 *
 * 왜 필요한가: bash·python·yaml 코드 예제의 **주석**이 `# ...` 으로 시작한다.
 * 코드블록을 무시하지 않으면 그 주석을 마크다운 h1 으로 오인해, 멀쩡한 챕터를
 * "h1 이 있다"며 거부한다(실제로 그렇게 한 번 실패했다).
 */
function eachLineOutsideCode(markdown, visit) {
  let inFence = false;
  return markdown.split("\n").map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    return inFence ? line : visit(line);
  });
}

/** 코드블록 밖에 h1(# )이 있는가. */
function hasTopLevelHeading(markdown) {
  let found = false;
  eachLineOutsideCode(markdown, (line) => {
    if (/^#\s/.test(line)) found = true;
    return line;
  });
  return found;
}

/**
 * 모든 제목을 한 단계 낮춘다(# → ##, ## → ###, …).
 *
 * 챕터 제목은 시스템이 h1 으로 따로 렌더하므로 본문의 h1 은 중복이다. 그렇다고 이미
 * 다 써놓은 챕터를 버리는 건 낭비다 — h1 만 h2 로 바꾸면 기존 h2 와 충돌하므로
 * **전체를 한 칸씩 내린다**(h6 이 상한).
 */
function demoteHeadings(markdown) {
  return eachLineOutsideCode(markdown, (line) => {
    const m = /^(#{1,5})(\s)/.exec(line);
    return m ? `#${m[1]}${m[2]}${line.slice(m[0].length)}` : line;
  }).join("\n");
}

// ── 1) 기획안 로드 + 검증 ────────────────────────────────────────────────────
let outline;
try {
  outline = JSON.parse(await readFile(".ai/outline.json", "utf8"));
} catch (e) {
  fail(`.ai/outline.json 을 읽을 수 없습니다: ${e.message}`);
}

need(typeof outline.topic_slug === "string" && TOPIC_SLUG_RE.test(outline.topic_slug), "topic_slug 형식 오류");
need(
  typeof outline.slug === "string" && SLUG_RE.test(outline.slug),
  "slug 는 영문 소문자·숫자·하이픈만(3~60자). 한글 slug 는 DB 조회가 깨진다",
);
need(typeof outline.title === "string" && outline.title.trim().length >= 2, "title 누락");
need(
  typeof outline.description === "string" && outline.description.trim().length >= 30,
  "description 이 30자 미만(검색 결과·카드에 노출되는 문구다)",
);
need(
  Array.isArray(outline.chapters) &&
    outline.chapters.length >= MIN_CHAPTERS &&
    outline.chapters.length <= MAX_CHAPTERS,
  `챕터가 ${MIN_CHAPTERS}~${MAX_CHAPTERS}개여야 합니다 (현재 ${outline.chapters?.length ?? 0}개)`,
);

const seen = new Set();
for (const [i, ch] of outline.chapters.entries()) {
  need(typeof ch.slug === "string" && SLUG_RE.test(ch.slug), `chapters[${i}].slug 형식 오류`);
  need(typeof ch.title === "string" && ch.title.trim(), `chapters[${i}].title 누락`);
  need(!seen.has(ch.slug), `챕터 slug 중복: ${ch.slug}`);
  seen.add(ch.slug);
}

// ── 2) 챕터 본문 로드 + 분량 검증 ────────────────────────────────────────────
const chapters = [];
for (const ch of outline.chapters) {
  const file = path.join(".ai/chapters", `${ch.slug}.md`);
  let body;
  try {
    body = await readFile(file, "utf8");
  } catch {
    fail(`챕터 본문 파일이 없습니다: ${file}`);
  }

  const len = body.trim().length;
  need(len >= MIN_BODY_CHARS, `${ch.slug}.md 가 ${len}자 — 최소 ${MIN_BODY_CHARS}자 필요`);
  // 코드 예제가 없는 기술 서적은 교과서 품질이 아니다.
  need(body.includes("```"), `${ch.slug}.md 에 코드블록(\`\`\`)이 없습니다`);

  // h1 은 시스템이 챕터 제목으로 따로 렌더하므로 본문에 있으면 중복이다.
  // 하지만 다 써놓은 챕터를 이것 때문에 버리는 건 낭비다 → 제목 레벨을 한 칸 내려 고친다.
  if (hasTopLevelHeading(body)) {
    body = demoteHeadings(body);
    console.log(`   ↳ ${ch.slug}.md: 본문에 h1 이 있어 제목 레벨을 한 단계 낮췄습니다`);
  }

  chapters.push({ slug: ch.slug, title: ch.title.trim(), body });
}

const totalChars = chapters.reduce((n, c) => n + c.body.length, 0);

// 다이어그램은 서적 전체 기준으로 센다(모든 챕터에 필요한 건 아니다).
// 글로만 된 기술 서적은 이해를 돕지 못한다 → 최소 2개를 강제한다.
const diagrams = chapters.reduce(
  (n, c) => n + (c.body.match(/```mermaid/g) ?? []).length,
  0,
);
need(
  diagrams >= MIN_DIAGRAMS,
  `mermaid 다이어그램이 ${diagrams}개 — 서적 전체에 최소 ${MIN_DIAGRAMS}개 필요`,
);

console.log(
  `📚 "${outline.title}" — 챕터 ${chapters.length}개, 총 ${totalChars.toLocaleString()}자, 다이어그램 ${diagrams}개`,
);

// ── 3) 저자 = 관리자 프로필 ──────────────────────────────────────────────────
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: userList } = await supabase.auth.admin.listUsers();
const admin = userList?.users?.find((u) => u.email?.toLowerCase() === adminEmail);
if (!admin) fail(`관리자 계정(${adminEmail})을 찾을 수 없습니다. 앱에서 먼저 가입하세요.`);

// ── 4) 토픽 — 없으면 생성 ────────────────────────────────────────────────────
const { data: existingTopic } = await supabase
  .from("topics")
  .select("slug")
  .eq("slug", outline.topic_slug)
  .maybeSingle();

if (!existingTopic) {
  const accent = ACCENTS.includes(outline.topic_accent) ? outline.topic_accent : "text-brand";
  const { error } = await supabase.from("topics").insert({
    slug: outline.topic_slug,
    label: (outline.topic_label || outline.topic_slug).slice(0, 40),
    description: (outline.topic_description || "").slice(0, 200),
    accent,
    sort_order: 9000,
    source: "ai",
  });
  if (error) fail(`토픽 생성 실패: ${error.message}`);
  console.log(`🆕 새 토픽 생성: ${outline.topic_slug}`);
}

// ── 5) 서적 — 항상 draft ─────────────────────────────────────────────────────
const bookSlug = `${outline.slug}-${Date.now().toString(36).slice(-5)}`;

const { data: created, error: bookErr } = await supabase
  .from("books")
  .insert({
    slug: bookSlug,
    language: outline.language ?? "ko",
    title: outline.title.trim(),
    description: outline.description.trim(),
    topic: outline.topic_slug,
    author_id: admin.id,
    source: "ai",
    status: "draft", // ← 자동 발행 없음. 관리자 승인 후에만 published.
    ai_model: "claude-code",
  })
  .select("id")
  .single();

if (bookErr || !created) fail(`서적 생성 실패: ${bookErr?.message}`);

// ── 6) 챕터 ──────────────────────────────────────────────────────────────────
const rows = chapters.map((ch, i) => ({
  book_id: created.id,
  slug: ch.slug,
  title: ch.title,
  body: ch.body,
  sort_order: (i + 1) * 1000,
}));

const { error: chErr } = await supabase.from("chapters").insert(rows);
if (chErr) {
  // 챕터가 없으면 반쪽짜리 서적이 검수 큐에 남는다 → 서적도 되돌린다.
  await supabase.from("books").delete().eq("id", created.id);
  fail(`챕터 생성 실패(서적 롤백함): ${chErr.message}`);
}

console.log(`✅ 초안 생성 완료 — /wiki/admin/books 에서 검수 후 발행하세요.`);
