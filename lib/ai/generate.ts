import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claude } from "./claude";
import { topicLabel } from "@/lib/wiki/topics";

/**
 * AI 서적 초안 생성(2단계). 결과는 항상 status='draft' → 관리자 검수 후 발행.
 * cron(/wiki/api/ai/generate)에서 service-role 클라이언트로 호출한다.
 */

interface OutlineChapter {
  title: string;
  slug: string;
  summary: string;
}
interface Outline {
  title: string;
  description: string;
  chapters: OutlineChapter[];
}

const OUTLINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    chapters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          slug: { type: "string" },
          summary: { type: "string" },
        },
        required: ["title", "slug", "summary"],
      },
    },
  },
  required: ["title", "description", "chapters"],
} as const;

const OUTLINE_SYSTEM = `당신은 시니어 엔지니어이자 기술 서적 저자입니다.
주어진 IT 토픽·소주제에 대해 학습자가 체계적으로 배울 수 있는 "서적"의 목차를 설계합니다.
- 5~9개의 챕터로 구성(학습목표 → 핵심개념 → 실전예제 → 함정 → 요약 순서의 흐름).
- 각 챕터 slug 는 영문 소문자·하이픈(kebab-case).
- 문서 복붙이 아니라 개념을 스스로 설명하는 구성.`;

const CHAPTER_SYSTEM = `당신은 시니어 엔지니어이자 기술 서적 저자입니다. 주어진 챕터를 마크다운 본문으로 작성합니다.
구성: 학습목표 → 개념 설명 → 실행 가능한 코드 예제(\`\`\`언어 코드블록\`\`\`) → 흔한 함정 → 요약 → 간단한 연습문제.
원칙: 문서를 그대로 복붙하지 말고 개념을 자신의 말로 설명. 버전 특이사항 명시. 최소 400자 이상, 코드 예제 1개 이상.
출력은 마크다운 본문만(제목 h1 은 넣지 말 것 — 시스템이 챕터 제목을 별도로 표시함).`;

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "untitled"
  );
}

/** job 을 받아 초안 서적+챕터를 생성하고 book id 를 반환. */
export async function generateBookDraft(
  supabase: SupabaseClient,
  job: {
    id: string;
    topic: string;
    subtopic: string;
    language: string;
    model: string;
  },
  adminAuthorId: string,
): Promise<string> {
  const label = topicLabel(job.topic);

  // 1) 목차(outline)
  const outline = await claude.completeJSON<Outline>({
    model: job.model,
    system: OUTLINE_SYSTEM,
    user: `토픽: ${label}\n소주제: ${job.subtopic}\n언어: ${job.language}`,
    schema: OUTLINE_SCHEMA,
    maxTokens: 4096,
  });

  const baseSlug = slugify(outline.title || job.subtopic);
  const slug = `${baseSlug}-${job.id.slice(0, 6)}`;

  const { data: book, error: bookErr } = await supabase
    .from("books")
    .insert({
      slug,
      language: job.language,
      title: outline.title,
      description: outline.description ?? "",
      topic: job.topic,
      author_id: adminAuthorId,
      source: "ai",
      status: "draft",
      ai_model: job.model,
    })
    .select("id")
    .single();
  if (bookErr || !book) {
    throw new Error(`book insert 실패: ${bookErr?.message}`);
  }

  // 2) 챕터 본문(순차 생성)
  const chapters = outline.chapters ?? [];
  // 챕터 slug 는 (book_id, slug) 유니크다. 모델이 비슷한 slug 를 두 번 내놓으면
  // insert 가 23505 로 실패해 챕터가 통째로 유실되므로, 삽입 전에 유일하게 만든다.
  const used = new Set<string>();
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    let slug = slugify(ch.slug || ch.title) || `chapter-${i + 1}`;
    if (used.has(slug)) slug = `${slug}-${i + 1}`.slice(0, 120);
    used.add(slug);

    const body = await claude.completeText({
      model: job.model,
      system: CHAPTER_SYSTEM,
      user: `서적: ${outline.title}\n챕터: ${ch.title}\n요약: ${ch.summary}\n언어: ${job.language}`,
      maxTokens: 8000,
    });
    const { error: chErr } = await supabase.from("chapters").insert({
      book_id: book.id,
      slug,
      title: ch.title,
      body,
      sort_order: (i + 1) * 1000,
    });
    // 조용히 넘기면 목차가 빈 반쪽짜리 초안이 검수 큐에 올라온다 → job 을 실패시킨다.
    if (chErr) {
      throw new Error(`chapter insert 실패(${ch.title}): ${chErr.message}`);
    }
  }

  return book.id;
}
