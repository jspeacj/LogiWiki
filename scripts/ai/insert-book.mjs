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
const MIN_CHAPTERS = 5;
const MAX_CHAPTERS = 18; // 주제에 따라 분량이 달라야 한다. 폭을 넓게 잡는다.
const MIN_BODY_CHARS = 1200;

/**
 * 챕터가 전부 같은 골격이면 기계가 찍어낸 티가 난다 — Google 의 "대규모 콘텐츠 남용"
 * 판정에서 가장 먼저 걸리는 신호이자, 사람 독자도 바로 알아채는 신호다.
 * 아래 상투적 소제목이 챕터 대부분에 반복되면 삽입을 거부한다.
 */
const BOILERPLATE_HEADINGS = ["학습 목표", "요약", "연습", "흔한 함정", "마치며", "정리"];
const BOILERPLATE_RATIO = 0.7;

/**
 * 소제목 하나하나로는 기준을 넘지 않지만 **합치면** 템플릿인 경우를 잡는다.
 *
 * 위 BOILERPLATE_RATIO 검사는 소제목별로 **독립적으로** 돈다. 그래서 "학습 목표" 69%,
 * "요약" 69%, "연습" 69% 인 원고는 세 검사를 모두 통과한다 — 사실상 모든 챕터가
 * 같은 틀인데도. 챕터당 평균 상투 소제목 개수로 그 구멍을 막는다.
 */
const BOILERPLATE_PER_CHAPTER_MAX = 1.5;

/** AI 가 쓴 티가 나는 상투어. 본문에서 발견되면 경고한다(거부는 아님). */
const AI_TELL_PHRASES = [
  "깊이 있게 알아보",
  "함께 살펴봅",
  "이번 챕터에서는",
  "결론적으로",
  "종합하면",
];

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

// 다이어그램은 서적 전체 기준으로 센다. 개수 하한은 두지 않는다 —
// 할당량을 채우려고 그린 다이어그램은 없느니만 못하고, 다이어그램이 필요 없는
// 주제도 있다. 필요할 때 그렸는지는 사람이 검수에서 판단한다.
const diagrams = chapters.reduce(
  (n, c) => n + (c.body.match(/```mermaid/g) ?? []).length,
  0,
);

// ── 상투적 골격 검사 ────────────────────────────────────────────────────────
// 모든 챕터가 "학습 목표 → 본문 → 요약 → 연습" 으로 똑같이 생겼다면 그건 템플릿을
// 채운 것이지 쓴 게 아니다. 검색엔진의 대규모 콘텐츠 남용 판정에 직결된다.
if (chapters.length >= 4) {
  let totalBoilerplateHits = 0;

  for (const heading of BOILERPLATE_HEADINGS) {
    const re = new RegExp(`^#{2,3}\\s*${heading}`, "m");
    const hits = chapters.filter((c) => re.test(c.body)).length;
    totalBoilerplateHits += hits;
    const ratio = hits / chapters.length;
    if (ratio >= BOILERPLATE_RATIO) {
      fail(
        `챕터 ${chapters.length}개 중 ${hits}개가 "${heading}" 소제목을 반복합니다 ` +
          `(${Math.round(ratio * 100)}%). 모든 챕터가 같은 틀이면 기계가 찍어낸 글이 됩니다 — ` +
          `각 챕터에 실제로 필요한 절만 두세요.`,
      );
    }
  }

  // 개별로는 다 통과하지만 합치면 템플릿인 경우(69% × 3종 …).
  const perChapter = totalBoilerplateHits / chapters.length;
  if (perChapter >= BOILERPLATE_PER_CHAPTER_MAX) {
    fail(
      `챕터당 상투적 소제목이 평균 ${perChapter.toFixed(1)}개입니다 ` +
        `(총 ${totalBoilerplateHits}개 / 챕터 ${chapters.length}개). 소제목별로는 기준을 넘지 ` +
        `않았더라도 합쳐 보면 모든 챕터가 같은 틀입니다 — 주제가 요구하는 절만 쓰세요.`,
    );
  }
}

// ── 상투어 경고 (거부하지는 않음 — 검수자가 판단) ─────────────────────────────
const tells = AI_TELL_PHRASES.flatMap((p) => {
  const n = chapters.filter((c) => c.body.includes(p)).length;
  return n > 0 ? [`"${p}"(${n}개 챕터)`] : [];
});
if (tells.length) {
  console.log(`⚠️  AI 상투어가 보입니다 — 검수 때 손보세요: ${tells.join(", ")}`);
}

const lens = chapters.map((c) => c.body.trim().length);
console.log(
  `📚 "${outline.title}" — 챕터 ${chapters.length}개, 총 ${totalChars.toLocaleString()}자, ` +
    `다이어그램 ${diagrams}개, 챕터 길이 ${Math.min(...lens).toLocaleString()}~${Math.max(...lens).toLocaleString()}자`,
);

// ── 3) 저자 = 관리자 프로필 ──────────────────────────────────────────────────
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: userList } = await supabase.auth.admin.listUsers();
const admin = userList?.users?.find((u) => u.email?.toLowerCase() === adminEmail);
if (!admin) fail(`관리자 계정(${adminEmail})을 찾을 수 없습니다. 앱에서 먼저 가입하세요.`);

// ── 3.5) 중복 서적 검사 ──────────────────────────────────────────────────────
//
// resolveSlug 는 slug 가 충돌하면 조용히 `-2` 를 붙이고 진행한다. 그래서 같은 주제를
// 두 번 쓰면 `react-hooks` 와 `react-hooks-2` 라는 거의 같은 내용의 서적 두 권이 만들어져
// 둘 다 검수 대기열에 들어가고, 승인되면 둘 다 sitemap 에 올라간다 — 중복 콘텐츠다.
// (퀴즈 파이프라인은 중복을 거르는데 서적은 안 걸렀다.)
//
// 제목을 정규화해 비교한다. 완전 일치면 거부 — 사람이 의도적으로 개정판을 쓰는 경우라면
// 제목을 바꾸거나 관리자 화면에서 직접 만들면 된다.
function normalizeTitle(s) {
  return s
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "") // 공백·구두점·기호 제거
    .trim();
}

const { data: existingBooks, error: titleErr } = await supabase
  .from("books")
  .select("title, slug, status")
  .eq("topic", outline.topic_slug);
if (titleErr) fail(`기존 서적 조회 실패: ${titleErr.message}`);

const incoming = normalizeTitle(outline.title);
const dupe = (existingBooks ?? []).find((b) => normalizeTitle(b.title) === incoming);
if (dupe) {
  fail(
    `같은 제목의 서적이 이미 있습니다: "${dupe.title}" (${dupe.slug}, ${dupe.status}). ` +
      `중복 서적을 만들지 않습니다 — 기존 서적을 보강하거나 다른 주제를 다루세요.`,
  );
}

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
// slug 는 URL 이자 SEO 자산이다. 예전에는 무조건 랜덤 접미사를 붙였는데(`react-ttj2o`),
// 그러면 사람이 지은 적 없는 기계식 URL 이 되고 검색 키워드도 잃는다.
// → 실제로 충돌할 때만 붙인다. 대부분의 서적은 깨끗한 slug 를 갖는다.
const bookSlug = await resolveSlug(outline.slug);

async function resolveSlug(base) {
  for (let n = 0; n < 10; n++) {
    // 접미사를 붙여도 DB CHECK(최대 60자)를 넘지 않도록 base 를 줄여둔다.
    const suffix = n === 0 ? "" : `-${n + 1}`;
    const candidate = base.slice(0, 60 - suffix.length) + suffix;
    const { data, error } = await supabase
      .from("books")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) fail(`slug 중복 확인 실패: ${error.message}`);
    if (!data) return candidate;
    console.log(`   ↳ slug 중복: ${candidate} — 다음 후보를 시도합니다`);
  }
  fail(`slug 후보를 10개 시도했으나 모두 중복입니다: ${base}`);
}

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
