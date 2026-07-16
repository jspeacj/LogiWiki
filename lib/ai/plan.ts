import "server-only";
import { revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claude, MODEL_DRAFT } from "./claude";
import { TOPICS_CACHE_TAG } from "@/lib/wiki/topics-db";

/**
 * 매일 생성할 서적 주제를 Claude 에게 제안받고, 필요하면 토픽을 새로 만든 뒤 job 을 큐에 넣는다.
 *
 * ⚠️ 실제 검색량 통계가 아니다. Google Ads/Trends 같은 유료·비공식 API 없이는 검색량을
 *    알 수 없으므로, "학습 수요가 높을 법한 주제"를 모델의 판단으로 제안받는다.
 *    이미 다룬 주제와 중복되지 않도록 기존 서적 제목·토픽을 프롬프트에 함께 넣는다.
 *
 * 생성 결과는 언제나 status='draft' → 관리자 검수 후에만 발행된다(불변 규칙).
 */

/** Tailwind 정적 리터럴만 허용(DB check 제약과 동일). 스캐너가 클래스를 만들어야 하므로. */
const ACCENTS = [
  "text-brand",
  "text-brand-2",
  "text-accent-amber",
  "text-accent-cyan",
  "text-accent-emerald",
  "text-muted-strong",
] as const;

interface Proposal {
  topic_slug: string;
  topic_label: string;
  topic_description: string;
  accent: string;
  subtopic: string;
  rationale: string;
}

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          topic_slug: { type: "string" },
          topic_label: { type: "string" },
          topic_description: { type: "string" },
          accent: { type: "string", enum: [...ACCENTS] },
          subtopic: { type: "string" },
          rationale: { type: "string" },
        },
        required: [
          "topic_slug",
          "topic_label",
          "topic_description",
          "accent",
          "subtopic",
          "rationale",
        ],
      },
    },
  },
  required: ["proposals"],
} as const;

const PLAN_SYSTEM = `당신은 IT 학습 플랫폼의 콘텐츠 기획자입니다.
개발자·학습자의 **학습 수요가 높고 검색될 만한** 주제를 골라 오늘 만들 서적의 기획안을 냅니다.

규칙:
- 이미 다룬 주제와 **중복되지 않아야** 합니다(아래 기존 목록 참고).
- subtopic 은 서적 한 권 분량의 구체적인 주제여야 합니다.
  (나쁨: "자바" / 좋음: "자바 동시성 — 스레드부터 가상 스레드까지")
- 가능하면 **기존 토픽**을 재사용하세요. 기존 토픽 중 어디에도 속하지 않는 분야일 때만
  새 토픽을 제안합니다(예: Rust, Kubernetes, 보안).
- topic_slug 는 영문 소문자·숫자·하이픈만(kebab-case), 40자 이내.
- 새 토픽이면 topic_label(한글 또는 영문 표기명)과 topic_description(30자 내외)도 채웁니다.
- 기존 토픽을 쓰는 경우에도 topic_slug 는 그 토픽의 슬러그를 정확히 씁니다.
- rationale 은 왜 지금 이 주제가 학습 수요가 있는지 1문장.`;

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 39);
}

/**
 * 오늘 만들 job 을 계획해 큐에 넣는다. 반환값은 큐에 넣은 개수.
 * service-role 클라이언트로 호출한다(cron 전용).
 */
export async function planDailyBooks(
  supabase: SupabaseClient,
  count: number,
  language: string,
  requestedBy: string | null,
): Promise<{ queued: number; newTopics: string[] }> {
  if (count <= 0) return { queued: 0, newTopics: [] };

  // 컨텍스트: 기존 토픽 + 이미 만든 서적(중복 회피).
  const [{ data: topicRows }, { data: bookRows }] = await Promise.all([
    supabase.from("topics").select("slug, label, description").order("sort_order"),
    supabase
      .from("books")
      .select("topic, title")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const existingTopics = (topicRows ?? []) as Array<{
    slug: string;
    label: string;
    description: string;
  }>;
  const existingSlugs = new Set(existingTopics.map((t) => t.slug));
  const existingBooks = (bookRows ?? []) as Array<{ topic: string; title: string }>;

  const user = [
    `오늘 만들 서적 수: ${count}`,
    `언어: ${language}`,
    "",
    "## 기존 토픽",
    existingTopics.map((t) => `- ${t.slug} (${t.label}): ${t.description}`).join("\n") ||
      "- (없음)",
    "",
    "## 이미 만든 서적(중복 금지)",
    existingBooks.map((b) => `- [${b.topic}] ${b.title}`).join("\n") || "- (없음)",
  ].join("\n");

  const plan = await claude.completeJSON<{ proposals: Proposal[] }>({
    model: MODEL_DRAFT,
    system: PLAN_SYSTEM,
    user,
    schema: PLAN_SCHEMA,
    maxTokens: 2048,
  });

  const proposals = (plan.proposals ?? []).slice(0, count);
  const newTopics: string[] = [];
  let queued = 0;

  for (const p of proposals) {
    const slug = normalizeSlug(p.topic_slug);
    if (!slug || !p.subtopic?.trim()) continue;

    // 없는 토픽이면 새로 만든다(source='ai'). 목록 맨 뒤에 배치.
    if (!existingSlugs.has(slug)) {
      const accent = (ACCENTS as readonly string[]).includes(p.accent)
        ? p.accent
        : "text-brand";
      const { error: topicErr } = await supabase.from("topics").insert({
        slug,
        label: (p.topic_label || slug).slice(0, 40),
        description: (p.topic_description || "").slice(0, 200),
        accent,
        sort_order: 9000,
        source: "ai",
      });
      if (topicErr) {
        console.error("[ai/plan] 토픽 생성 실패 — 이 제안은 건너뜀", {
          slug,
          message: topicErr.message,
        });
        continue;
      }
      existingSlugs.add(slug);
      newTopics.push(slug);
    }

    const { error: jobErr } = await supabase.from("ai_generation_jobs").insert({
      topic: slug,
      subtopic: p.subtopic.trim().slice(0, 200),
      language,
      model: MODEL_DRAFT,
      requested_by: requestedBy,
    });
    if (jobErr) {
      console.error("[ai/plan] job 등록 실패", { slug, message: jobErr.message });
      continue;
    }
    queued += 1;
  }

  // 토픽 목록은 5분 TTL 로 캐시된다(lib/wiki/topics-db.ts). 새로 만들었으면 즉시 무효화해
  // 다음 요청부터 보이게 한다. GitHub Actions 경로(scripts/ai/*.mjs)는 Next 런타임 밖이라
  // 이 호출을 못 하지만, 거기서 만든 토픽도 TTL 로 5분 안에 자연히 드러난다.
  // Next 16: revalidateTag 는 2인자다. "max" = stale-while-revalidate(권장) —
  // 1인자 형태는 즉시 만료라 다음 요청이 블로킹 미스가 되고, 이제 deprecated 다.
  if (newTopics.length > 0) revalidateTag(TOPICS_CACHE_TAG, "max");

  return { queued, newTopics };
}
