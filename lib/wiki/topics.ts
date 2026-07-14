/**
 * IT 학습 토픽 — **내장 기본값(시드 + 폴백)**.
 *
 * ⚠️ 런타임 SSOT 는 여기가 아니라 DB(`public.topics`)다. → lib/wiki/topics-db.ts
 * AI 자동 생성이 기존에 없던 분야(예: Rust, Kubernetes)를 다루면 토픽 행을 새로 만들기
 * 때문에, 화면과 검증은 모두 DB 를 읽어야 한다. 이 파일은 0011 마이그레이션의 시드 내용과
 * 동일하며, DB 를 읽지 못할 때의 폴백으로만 쓰인다.
 *
 * accent 는 Tailwind 정적 리터럴이라야 스캐너가 클래스를 생성한다(DB check 제약도 동일 목록).
 */

export interface Topic {
  slug: string;
  label: string;
  desc: string;
  /** 아이콘/배지 강조색 (정적 리터럴) */
  accent: string;
}

export const TOPICS: Topic[] = [
  { slug: "java", label: "Java", desc: "객체지향·JVM·스프링 생태계", accent: "text-accent-amber" },
  { slug: "cpp", label: "C++", desc: "시스템 프로그래밍·메모리·STL", accent: "text-accent-cyan" },
  { slug: "python", label: "Python", desc: "문법·데이터·자동화", accent: "text-accent-emerald" },
  { slug: "javascript", label: "JavaScript", desc: "언어 코어·비동기·브라우저", accent: "text-accent-amber" },
  { slug: "typescript", label: "TypeScript", desc: "타입 시스템·제네릭·설계", accent: "text-brand" },
  { slug: "react", label: "React", desc: "컴포넌트·훅·상태관리", accent: "text-accent-cyan" },
  { slug: "nextjs", label: "Next.js", desc: "App Router·렌더링·풀스택", accent: "text-brand-2" },
  { slug: "nodejs", label: "Node.js", desc: "런타임·서버·패키지", accent: "text-accent-emerald" },
  { slug: "spring", label: "Spring", desc: "DI·MVC·부트·데이터", accent: "text-accent-emerald" },
  { slug: "database", label: "데이터베이스", desc: "SQL·인덱스·트랜잭션·모델링", accent: "text-accent-cyan" },
  { slug: "algorithm", label: "알고리즘", desc: "자료구조·복잡도·문제풀이", accent: "text-brand" },
  { slug: "cs", label: "컴퓨터 과학", desc: "운영체제·네트워크·컴퓨터구조", accent: "text-muted-strong" },
  { slug: "devops", label: "DevOps", desc: "Docker·CI/CD·클라우드", accent: "text-accent-amber" },
  { slug: "ai", label: "AI · 머신러닝", desc: "ML 기초·딥러닝·LLM 활용", accent: "text-brand-2" },
];

export const TOPIC_SLUGS = TOPICS.map((t) => t.slug);

const TOPIC_BY_SLUG = new Map(TOPICS.map((t) => [t.slug, t]));

export function isTopic(slug: unknown): slug is string {
  return typeof slug === "string" && TOPIC_BY_SLUG.has(slug);
}

export function getTopic(slug: string): Topic | undefined {
  return TOPIC_BY_SLUG.get(slug);
}

/** 토픽 라벨(없으면 슬러그 그대로) */
export function topicLabel(slug: string): string {
  return TOPIC_BY_SLUG.get(slug)?.label ?? slug;
}
