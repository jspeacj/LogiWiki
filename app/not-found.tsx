import Link from "next/link";
import { BookOpen, Home } from "lucide-react";

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
