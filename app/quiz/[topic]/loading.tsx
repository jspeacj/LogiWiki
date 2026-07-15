import { Skeleton } from "@/components/ui/skeleton";

/** /quiz/[topic] 로딩 스켈레톤 — 헤더 + 문제 카드 골격. "다음 문제" 전환 시에도 뜬다. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-2 h-9 w-56" />
      </header>
      <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}
