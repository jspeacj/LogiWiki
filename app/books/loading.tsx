import { Skeleton, BookGridSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="mt-2 h-9 w-64" />
        <Skeleton className="mt-4 h-4 w-full max-w-2xl" />
      </header>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <div className="mt-6">
        <BookGridSkeleton />
      </div>
    </div>
  );
}
