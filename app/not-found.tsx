import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Home } from "lucide-react";

/**
 * not-found UI 는 절대 색인하지 않는다.
 *
 * 스트리밍(loading.tsx)·ISR 라우트에서 notFound() 는 HTTP 200 을 반환할 수밖에 없다(응답
 * 헤더가 이미 나간 뒤라 상태를 못 바꾼다 — Next 공식 문서화된 동작). 대신 notFound() 는
 * 자동으로 noindex 메타를 주입해 색인을 막는다. 여기에 not-found UI 자체에도 명시적 noindex 를
 * 두어, 사이트가 공개(NEXT_PUBLIC_NOINDEX=false)된 뒤에도 soft-404 페이지가 색인되지 않게 못박는다.
 */
export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-5 py-28 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white glow-brand">
        <BookOpen className="size-7" strokeWidth={2} />
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">페이지를 찾을 수 없어요</h1>
      <p className="mt-3 text-muted">
        찾으시는 서적이나 페이지가 없거나, 아직 발행되지 않았을 수 있습니다.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand to-brand-2 px-5 py-2.5 text-sm font-medium text-white transition-[filter] hover:brightness-110"
      >
        <Home className="size-4" strokeWidth={2.2} />
        홈으로
      </Link>
    </div>
  );
}
